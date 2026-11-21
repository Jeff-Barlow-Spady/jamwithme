// functions/api/tapes.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (!env.CLIPS_BUCKET) {
    return jsonResponse({ error: 'R2 binding CLIPS_BUCKET not configured' }, 500);
  }

  const videoKey = url.searchParams.get('key');

  // 1. STREAM AUDIO/VIDEO CLIP WITH HTTP 206 RANGE SUPPORT (required for mobile Safari seeking)
  if (method === 'GET' && videoKey) {
    const rangeHeader = request.headers.get('range');
    const object = await env.CLIPS_BUCKET.get(videoKey, {
      range: rangeHeader ? request.headers : undefined,
    });

    if (!object) {
      return new Response('Clip not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', 'public, max-age=3600');

    if (rangeHeader && object.range) {
      const { offset, length } = object.range;
      const end = offset + length - 1;
      headers.set('content-range', `bytes ${offset}-${end}/${object.size}`);
      headers.set('content-length', String(length));
      return new Response(object.body, { status: 206, headers });
    }

    headers.set('content-length', String(object.size));
    return new Response(object.body, { status: 200, headers });
  }

  // 2. LIST ALL CLIPS IN R2
  if (method === 'GET') {
    const listed = await env.CLIPS_BUCKET.list({ include: ['customMetadata'] });
    const tracks = listed.objects
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
      .map((obj, idx) => {
        const meta = obj.customMetadata || {};
        return {
          id: obj.key,
          num: String(idx + 1).padStart(2, '0'),
          side: meta.side === 'B' ? 'B' : 'A',
          filename: meta.title || obj.key,
          genre: meta.genre || 'RAW RIFF',
          tuning: meta.tuning || 'E STANDARD',
          duration: meta.duration || '0:30',
          mediaType: meta.mediaType || 'video',
          src: `/api/tapes?key=${encodeURIComponent(obj.key)}`,
        };
      });

    return jsonResponse({ tracks });
  }

  // AUTH CHECK FOR WRITE / DELETE OPERATIONS
  const authHeader = request.headers.get('Authorization') || '';
  const providedPin = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!env.UPLOAD_PIN || providedPin !== env.UPLOAD_PIN) {
    return jsonResponse({ error: 'Invalid upload PIN' }, 401);
  }

  // 3. UPLOAD AUDIO OR VIDEO CLIP FROM PHONE
  if (method === 'POST') {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return jsonResponse({ error: 'No audio or video file attached' }, 400);
    }

    const side = formData.get('side') === 'B' ? 'B' : 'A';
    const title = String(formData.get('title') || 'UNTITLED_RIFF').trim();
    const genre = String(formData.get('genre') || 'RAW').trim();
    const tuning = String(formData.get('tuning') || 'E STANDARD').trim();
    const duration = String(formData.get('duration') || '0:30').trim();
    const isAudio = (file.type || '').startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name || '');

    const safeSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clip';
    const ext = (file.name && file.name.split('.').pop()) || (isAudio ? 'm4a' : 'mp4');
    const key = `${Date.now()}-${safeSlug}.${ext}`;

    await env.CLIPS_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || (isAudio ? 'audio/mp4' : 'video/mp4'),
      },
      customMetadata: {
        side,
        title,
        genre,
        tuning,
        duration,
        mediaType: isAudio ? 'audio' : 'video',
      },
    });

    return jsonResponse({ ok: true, key });
  }

  // 4. DELETE CLIP FROM PHONE
  if (method === 'DELETE') {
    if (!videoKey) {
      return jsonResponse({ error: 'Missing clip key' }, 400);
    }
    await env.CLIPS_BUCKET.delete(videoKey);
    return jsonResponse({ ok: true, deleted: videoKey });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
