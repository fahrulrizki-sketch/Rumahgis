export const THREADS_TEXT_LIMIT = 500;

export function validateItem(item, label = 'item') {
  const errors = [];
  if (!item || typeof item !== 'object') {
    return [`${label} wajib berupa object`];
  }

  if (typeof item.text !== 'string' || !item.text.trim()) {
    errors.push(`${label}.text wajib diisi`);
  } else if ([...item.text].length > THREADS_TEXT_LIMIT) {
    errors.push(`${label}.text melebihi ${THREADS_TEXT_LIMIT} karakter`);
  }

  const media = item.media;
  if (media != null) {
    if (typeof media !== 'object') {
      errors.push(`${label}.media wajib berupa object`);
    } else {
      const hasImage = Boolean(media.image_url);
      const hasVideo = Boolean(media.video_url);
      if (hasImage && hasVideo) {
        errors.push(`${label}.media hanya boleh berisi image_url atau video_url, bukan keduanya`);
      }
      for (const key of ['image_url', 'video_url']) {
        if (media[key] != null) {
          try {
            const u = new URL(media[key]);
            if (u.protocol !== 'https:') errors.push(`${label}.media.${key} harus menggunakan HTTPS`);
          } catch {
            errors.push(`${label}.media.${key} bukan URL valid`);
          }
        }
      }
    }
  }

  return errors;
}

export function validateThread(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['payload wajib berupa object'];
  errors.push(...validateItem(data.main, 'main'));

  if (data.replies != null && !Array.isArray(data.replies)) {
    errors.push('replies wajib berupa array');
  } else {
    (data.replies || []).forEach((reply, index) => {
      errors.push(...validateItem(reply, `replies[${index}]`));
    });
  }

  return errors;
}
