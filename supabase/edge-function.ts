import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN = Deno.env.get('NOTEBOOK_API_TOKEN')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Notebook-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ua = enc.encode(a)
  const ub = enc.encode(b)
  if (ua.length !== ub.length) return false
  let result = 0
  for (let i = 0; i < ua.length; i++) result |= ua[i] ^ ub[i]
  return result === 0
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  })
}

function dbError() {
  return json({ error: 'Internal server error' }, 500)
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const clientToken = req.headers.get('X-Notebook-Token') || ''
  if (!TOKEN || !safeEqual(TOKEN, clientToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/\/$/, '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  if (path === '/notebook-api/entries' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('notebook_entries')
      .select('*, annotation_count:notebook_annotations(count)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return dbError()

    const entries = (data || []).map((e: any) => ({
      ...e,
      annotation_count: e.annotation_count?.[0]?.count || 0
    }))

    return json(entries)
  }

  if (path.startsWith('/notebook-api/entries/') && req.method === 'GET' && !path.endsWith('/annotations')) {
    const id = path.split('/')[3]
    if (!id || !/^\d+$/.test(id)) return json({ error: 'Invalid id' }, 400)
    const { data: entry, error: entryError } = await supabase
      .from('notebook_entries')
      .select('*')
      .eq('id', id)
      .single()

    if (entryError || !entry) return json({ error: 'Not found' }, 404)

    const { data: annotations } = await supabase
      .from('notebook_annotations')
      .select('*')
      .eq('entry_id', id)
      .order('created_at', { ascending: true })

    return json({ ...entry, annotations: annotations || [] })
  }

  if (path === '/notebook-api/settings' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('notebook_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return json({
        ai_name: 'Lori',
        user_name: '猫猫',
        ai_icon: '',
        user_icon: ''
      })
    }

    return json(data)
  }

  if (path === '/notebook-api/entries' && req.method === 'POST') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }
    const { content, pinned } = body

    if (typeof content !== 'string' || content.length === 0) {
      return json({ error: 'content is required' }, 400)
    }

    if (new TextEncoder().encode(content).length > 10240) {
      return json({ error: 'content exceeds 10KB limit' }, 400)
    }

    const { data, error } = await supabase
      .from('notebook_entries')
      .insert({ author: 'user', content, pinned: pinned || false })
      .select()
      .single()

    if (error) return dbError()
    return json(data, 201)
  }

  if (path.startsWith('/notebook-api/entries/') && !path.endsWith('/annotations') && req.method === 'PATCH') {
    const id = path.split('/')[3]
    if (!id || !/^\d+$/.test(id)) return json({ error: 'Invalid id' }, 400)

    const { data: existing, error: findError } = await supabase
      .from('notebook_entries')
      .select('author')
      .eq('id', id)
      .single()

    if (findError || !existing) return json({ error: 'Not found' }, 404)
    if (existing.author !== 'user') return json({ error: 'Forbidden' }, 403)

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }
    const update: any = {}
    if (typeof body.content === 'string') update.content = body.content
    if (typeof body.pinned === 'boolean') update.pinned = body.pinned

    if (update.content && new TextEncoder().encode(update.content).length > 10240) {
      return json({ error: 'content exceeds 10KB limit' }, 400)
    }

    const { data, error } = await supabase
      .from('notebook_entries')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return dbError()
    return json(data)
  }

  if (path.startsWith('/notebook-api/entries/') && !path.endsWith('/annotations') && req.method === 'DELETE') {
    const id = path.split('/')[3]
    if (!id || !/^\d+$/.test(id)) return json({ error: 'Invalid id' }, 400)

    const { data: existing, error: findError } = await supabase
      .from('notebook_entries')
      .select('author')
      .eq('id', id)
      .single()

    if (findError || !existing) return json({ error: 'Not found' }, 404)
    if (existing.author !== 'user') return json({ error: 'Forbidden' }, 403)

    const { error } = await supabase
      .from('notebook_entries')
      .delete()
      .eq('id', id)

    if (error) return dbError()
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (path.match(/^\/notebook-api\/entries\/\d+\/annotations$/) && req.method === 'POST') {
    const id = path.split('/')[3]
    if (!id || !/^\d+$/.test(id)) return json({ error: 'Invalid id' }, 400)
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }
    const { content } = body

    if (typeof content !== 'string' || content.length === 0) {
      return json({ error: 'content is required' }, 400)
    }

    if (new TextEncoder().encode(content).length > 10240) {
      return json({ error: 'content exceeds 10KB limit' }, 400)
    }

    const { data, error } = await supabase
      .from('notebook_annotations')
      .insert({ entry_id: id, author: 'user', content })
      .select()
      .single()

    if (error) return dbError()
    return json(data, 201)
  }

  return json({ error: 'Not found' }, 404)
}

Deno.serve(handler)
