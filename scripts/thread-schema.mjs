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

  if (data.affiliate != null) {
    if (typeof data.affiliate !== 'object' || Array.isArray(data.affiliate)) {
      errors.push('affiliate wajib berupa object');
    } else {
      if (!['auto', 'yes', 'no'].includes(data.affiliate.mode)) {
        errors.push('affiliate.mode harus auto, yes, atau no');
      }
      if (data.affiliate.product_id != null && (typeof data.affiliate.product_id !== 'string' || !data.affiliate.product_id.trim())) {
        errors.push('affiliate.product_id harus berupa string yang tidak kosong');
      }
      if (data.affiliate.product_ids != null && (
        !Array.isArray(data.affiliate.product_ids)
        || data.affiliate.product_ids.length === 0
        || data.affiliate.product_ids.some((id) => typeof id !== 'string' || !id.trim())
        || new Set(data.affiliate.product_ids).size !== data.affiliate.product_ids.length
      )) {
        errors.push('affiliate.product_ids harus berupa array ID unik yang tidak kosong');
      }
      if (data.affiliate.product_id && data.affiliate.product_ids) {
        errors.push('gunakan product_id atau product_ids, bukan keduanya');
      }
      if (data.affiliate.mode === 'no' && (data.affiliate.product_id || data.affiliate.product_ids)) {
        errors.push('affiliate product tidak boleh diisi ketika mode no');
      }
    }
  }

  return errors;
}
