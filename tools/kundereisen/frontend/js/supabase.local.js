if (location.hostname !== '127.0.0.1') throw Error('Local portal only');
export const LOCAL_SUPABASE_CONFIG = Object.freeze({url:location.origin, key:'local-preview-public'});
