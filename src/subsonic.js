/**
 * Subsonic API Client
 * Implements the Subsonic REST API for music streaming
 * API Spec: http://www.subsonic.org/pages/api.jsp
 */

const API_VERSION = '1.16.1';
const CLIENT_NAME = 'SomeSonic';

/**
 * Generate MD5 hash for authentication
 * @param {string} str - String to hash
 * @returns {Promise<string>} - MD5 hash
 */
async function md5(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => null);
    
    // Fallback for browsers that don't support MD5 in SubtleCrypto
    if (!hashBuffer) {
        // Simple MD5 implementation for authentication
        return simpleMd5(str);
    }
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple MD5 implementation as fallback
 * @param {string} str 
 * @returns {string}
 */
function simpleMd5(str) {
    // This is a minimal MD5 implementation for Subsonic auth
    // In production, consider using a proper crypto library
    function rotateLeft(x, n) {
        return (x << n) | (x >>> (32 - n));
    }
    
    function addUnsigned(x, y) {
        const x8 = (x & 0x80000000);
        const y8 = (y & 0x80000000);
        const x4 = (x & 0x40000000);
        const y4 = (y & 0x40000000);
        const result = (x & 0x3FFFFFFF) + (y & 0x3FFFFFFF);
        if (x4 & y4) return (result ^ 0x80000000 ^ x8 ^ y8);
        if (x4 | y4) {
            if (result & 0x40000000) return (result ^ 0xC0000000 ^ x8 ^ y8);
            return (result ^ 0x40000000 ^ x8 ^ y8);
        }
        return (result ^ x8 ^ y8);
    }
    
    function f(x, y, z) { return (x & y) | ((~x) & z); }
    function g(x, y, z) { return (x & z) | (y & (~z)); }
    function h(x, y, z) { return (x ^ y ^ z); }
    function i(x, y, z) { return (y ^ (x | (~z))); }
    
    function ff(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function gg(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function hh(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function ii(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function convertToWordArray(str) {
        const lWordCount = (((str.length + 8) - ((str.length + 8) % 64)) / 64 + 1) * 16;
        const lWordArray = Array(lWordCount - 1).fill(0);
        let lByteCount = 0;
        let lBytePosition = 0;
        while (lByteCount < str.length) {
            lBytePosition = (lByteCount - (lByteCount % 4)) / 4;
            const lByteInWord = (lByteCount % 4) * 8;
            lWordArray[lBytePosition] = (lWordArray[lBytePosition] | (str.charCodeAt(lByteCount) << lByteInWord));
            lByteCount++;
        }
        lBytePosition = (lByteCount - (lByteCount % 4)) / 4;
        const lByteInWord = (lByteCount % 4) * 8;
        lWordArray[lBytePosition] = lWordArray[lBytePosition] | (0x80 << lByteInWord);
        lWordArray[lWordCount - 2] = str.length << 3;
        lWordArray[lWordCount - 1] = str.length >>> 29;
        return lWordArray;
    }
    
    function wordToHex(value) {
        let hex = '';
        for (let i = 0; i <= 3; i++) {
            const byte = (value >>> (i * 8)) & 255;
            hex += ('0' + byte.toString(16)).slice(-2);
        }
        return hex;
    }
    
    const x = convertToWordArray(str);
    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    
    for (let k = 0; k < x.length; k += 16) {
        const AA = a, BB = b, CC = c, DD = d;
        
        a = ff(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        d = ff(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = ff(c, d, a, b, x[k + 2], S13, 0x242070DB);
        b = ff(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = ff(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        d = ff(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = ff(c, d, a, b, x[k + 6], S13, 0xA8304613);
        b = ff(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = ff(a, b, c, d, x[k + 8], S11, 0x698098D8);
        d = ff(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = ff(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
        b = ff(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = ff(a, b, c, d, x[k + 12], S11, 0x6B901122);
        d = ff(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = ff(c, d, a, b, x[k + 14], S13, 0xA679438E);
        b = ff(b, c, d, a, x[k + 15], S14, 0x49B40821);
        
        a = gg(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        d = gg(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = gg(c, d, a, b, x[k + 11], S23, 0x265E5A51);
        b = gg(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = gg(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        d = gg(d, a, b, c, x[k + 10], S22, 0x2441453);
        c = gg(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
        b = gg(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = gg(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        d = gg(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = gg(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
        b = gg(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = gg(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        d = gg(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = gg(c, d, a, b, x[k + 7], S23, 0x676F02D9);
        b = gg(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        
        a = hh(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        d = hh(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = hh(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
        b = hh(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = hh(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        d = hh(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = hh(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
        b = hh(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = hh(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        d = hh(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = hh(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
        b = hh(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = hh(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        d = hh(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = hh(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
        b = hh(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        
        a = ii(a, b, c, d, x[k + 0], S41, 0xF4292244);
        d = ii(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = ii(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
        b = ii(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = ii(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        d = ii(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = ii(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
        b = ii(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = ii(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        d = ii(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = ii(c, d, a, b, x[k + 6], S43, 0xA3014314);
        b = ii(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = ii(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        d = ii(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = ii(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
        b = ii(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        
        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }
    
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

/**
 * Generate random salt for authentication
 * @returns {string} Random hex string
 */
function generateSalt() {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Subsonic API Client Class
 */
export class SubsonicClient {
    /**
     * Create a new Subsonic client
     * @param {Object} config - Configuration object
     * @param {string} config.serverUrl - Server URL
     * @param {string} config.username - Username
     * @param {string} config.password - Password
     */
    constructor(config = {}) {
        this.serverUrl = config.serverUrl || '';
        this.username = config.username || '';
        this.password = config.password || '';
        this.salt = generateSalt();
        this.token = null;
    }

    /**
     * Set credentials
     * @param {string} serverUrl 
     * @param {string} username 
     * @param {string} password 
     */
    setCredentials(serverUrl, username, password) {
        this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
        this.username = username;
        this.password = password;
        this.salt = generateSalt();
        this.token = null;
    }

    /**
     * Generate authentication token
     * @returns {Promise<string>} Authentication token
     */
    async generateToken() {
        this.salt = generateSalt();
        this.token = simpleMd5(this.password + this.salt);
        return this.token;
    }

    /**
     * Build API URL with authentication parameters
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Additional parameters
     * @returns {Promise<string>} Full API URL
     */
    async buildUrl(endpoint, params = {}) {
        if (!this.token) {
            await this.generateToken();
        }

        const url = new URL(`${this.serverUrl}/rest/${endpoint}`);
        
        // Add common parameters
        url.searchParams.set('u', this.username);
        url.searchParams.set('t', this.token);
        url.searchParams.set('s', this.salt);
        url.searchParams.set('v', API_VERSION);
        url.searchParams.set('c', CLIENT_NAME);
        url.searchParams.set('f', 'json');

        // Add additional parameters
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        }

        return url.toString();
    }

    /**
     * Make API request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Additional parameters
     * @returns {Promise<Object>} API response
     */
    async request(endpoint, params = {}) {
        const url = await this.buildUrl(endpoint, params);
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data['subsonic-response']?.status === 'failed') {
                const error = data['subsonic-response'].error;
                throw new Error(error?.message || 'Unknown API error');
            }

            return data['subsonic-response'];
        } catch (error) {
            console.error('Subsonic API error:', error);
            throw error;
        }
    }

    /**
     * Ping server to test connection
     * @returns {Promise<boolean>} True if connection successful
     */
    async ping() {
        const response = await this.request('ping');
        return response?.status === 'ok';
    }

    /**
     * Get all artists
     * @returns {Promise<Array>} List of artists
     */
    async getArtists() {
        const response = await this.request('getArtists');
        return response?.artists?.index || [];
    }

    /**
     * Get all albums
     * @param {Object} options - Options
     * @param {string} options.type - Album list type (random, newest, highest, frequent, recent, alphabeticalByName, alphabeticalByArtist, starred)
     * @param {number} options.size - Number of albums to return
     * @param {number} options.offset - Offset for pagination
     * @returns {Promise<Array>} List of albums
     */
    async getAlbumList(options = {}) {
        const response = await this.request('getAlbumList2', {
            type: options.type || 'alphabeticalByArtist',
            size: options.size || 500,
            offset: options.offset || 0
        });
        return response?.albumList2?.album || [];
    }

    /**
     * Get album details
     * @param {string} id - Album ID
     * @returns {Promise<Object>} Album details with songs
     */
    async getAlbum(id) {
        const response = await this.request('getAlbum', { id });
        return response?.album;
    }

    /**
     * Get artist details
     * @param {string} id - Artist ID
     * @returns {Promise<Object>} Artist details
     */
    async getArtist(id) {
        const response = await this.request('getArtist', { id });
        return response?.artist;
    }

    /**
     * Search for music
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async search(query, options = {}) {
        const response = await this.request('search3', {
            query,
            artistCount: options.artistCount || 20,
            albumCount: options.albumCount || 20,
            songCount: options.songCount || 50
        });
        return response?.searchResult3 || {};
    }

    /**
     * Get playlists
     * @returns {Promise<Array>} List of playlists
     */
    async getPlaylists() {
        const response = await this.request('getPlaylists');
        return response?.playlists?.playlist || [];
    }

    /**
     * Get playlist details
     * @param {string} id - Playlist ID
     * @returns {Promise<Object>} Playlist with songs
     */
    async getPlaylist(id) {
        const response = await this.request('getPlaylist', { id });
        return response?.playlist;
    }

    /**
     * Get stream URL for a song
     * @param {string} id - Song ID
     * @param {Object} options - Stream options
     * @returns {Promise<string>} Stream URL
     */
    async getStreamUrl(id, options = {}) {
        return this.buildUrl('stream', {
            id,
            maxBitRate: options.maxBitRate,
            format: options.format
        });
    }

    /**
     * Get cover art URL
     * @param {string} id - Cover art ID
     * @param {number} size - Image size
     * @returns {Promise<string>} Cover art URL
     */
    async getCoverArtUrl(id, size = 300) {
        return this.buildUrl('getCoverArt', { id, size });
    }

    /**
     * Get random songs
     * @param {Object} options - Options
     * @returns {Promise<Array>} Random songs
     */
    async getRandomSongs(options = {}) {
        const response = await this.request('getRandomSongs', {
            size: options.size || 50,
            genre: options.genre,
            fromYear: options.fromYear,
            toYear: options.toYear,
            musicFolderId: options.musicFolderId
        });
        return response?.randomSongs?.song || [];
    }

    /**
     * Get starred items
     * @returns {Promise<Object>} Starred artists, albums, and songs
     */
    async getStarred() {
        const response = await this.request('getStarred2');
        return response?.starred2 || {};
    }

    /**
     * Star an item
     * @param {string} id - Item ID
     * @param {string} type - Item type (song, album, artist)
     * @returns {Promise<boolean>} Success
     */
    async star(id, type = 'song') {
        const params = {};
        if (type === 'artist') params.artistId = id;
        else if (type === 'album') params.albumId = id;
        else params.id = id;
        
        await this.request('star', params);
        return true;
    }

    /**
     * Unstar an item
     * @param {string} id - Item ID
     * @param {string} type - Item type (song, album, artist)
     * @returns {Promise<boolean>} Success
     */
    async unstar(id, type = 'song') {
        const params = {};
        if (type === 'artist') params.artistId = id;
        else if (type === 'album') params.albumId = id;
        else params.id = id;
        
        await this.request('unstar', params);
        return true;
    }

    /**
     * Scrobble a song (report playback)
     * @param {string} id - Song ID
     * @param {boolean} submission - True for scrobble, false for now playing
     * @returns {Promise<boolean>} Success
     */
    async scrobble(id, submission = true) {
        await this.request('scrobble', { id, submission });
        return true;
    }

    /**
     * Get music folders
     * @returns {Promise<Array>} Music folders
     */
    async getMusicFolders() {
        const response = await this.request('getMusicFolders');
        return response?.musicFolders?.musicFolder || [];
    }

    /**
     * Get genres
     * @returns {Promise<Array>} List of genres
     */
    async getGenres() {
        const response = await this.request('getGenres');
        return response?.genres?.genre || [];
    }

    /**
     * Get songs by genre
     * @param {string} genre - Genre name
     * @param {Object} options - Options
     * @returns {Promise<Array>} Songs
     */
    async getSongsByGenre(genre, options = {}) {
        const response = await this.request('getSongsByGenre', {
            genre,
            count: options.count || 50,
            offset: options.offset || 0
        });
        return response?.songsByGenre?.song || [];
    }
}

export default SubsonicClient;
