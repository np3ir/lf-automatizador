const fs = require('fs');
const path = require('path');
const https = require('https');
const db = require('../../database.js');
const configDir = path.dirname(db.dbPath);
const { cleanCsvList, mergeCsvList, cleanMetaString, tokenSet, jaccard, waitRateLimit } = require('../utils/helpers.js');

// Prepared statements locales
const selectTrackByPathStmt = db.prepare("SELECT * FROM tracks WHERE file_path = ?");

// Lectura de firma de archivo (tamaño + fecha)
function getTrackFileSignature(filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) return null;
        return {
            fileSize: Number(stats.size) || 0,
            fileMtimeMs: Math.round(Number(stats.mtimeMs) || 0)
        };
    } catch (err) {
        return null;
    }
}

// Dependencias inyectadas desde main.js para evitar importaciones circulares.
// main.js llama a artists._injectDeps({ upsertGenreProfile, applyGenreToTrackPaths })
// después de cargar ambos módulos.
const _deps = {};
function _injectDeps(deps) {
    Object.assign(_deps, deps);
}
function upsertGenreProfile(name, parentKey) {
    if (_deps.upsertGenreProfile) return _deps.upsertGenreProfile(name, parentKey);
    return null; // Fallback seguro si aún no se inyectó
}
function applyGenreToTrackPaths(paths, genreName, sub, source, folder) {
    if (_deps.applyGenreToTrackPaths) return _deps.applyGenreToTrackPaths(paths, genreName, sub, source, folder);
    return { updatedTracks: 0 };
}


﻿const PROTECTED_ARTIST_GROUP_NAMES = [
    'AC/DC',
    'Chino y Nacho',
    'Sandy y Papo',
    'Wisin y Yandel',
    'Alexis y Fido',
    'Zion y Lennox',
    'Jowell y Randy',
    'Mau y Ricky',
    'Monchy y Alexandra',
    'Hector y Tito',
    'Baby Rasta y Gringo',
    'Angel y Khriz',
    'RKM y Ken-Y',
    'Rakim y Ken-Y'
];

function normalizeArtistGroupKey(value) {
    return normalizeArtistKey(String(value || '').replace(/&/g, ' y ').replace(/\+/g, ' y '));
}

const PROTECTED_ARTIST_GROUP_KEYS = new Set(PROTECTED_ARTIST_GROUP_NAMES.map(normalizeArtistGroupKey));

function isProtectedArtistGroup(value) {
    const key = normalizeArtistGroupKey(value);
    return !!key && PROTECTED_ARTIST_GROUP_KEYS.has(key);
}

function parseTitleAndArtist(rawArtist, rawTitle) {
    let artist = (rawArtist || '').trim(); let title = (rawTitle || '').trim(); let feats = []; let isRemix = false;
    const remixMatch = title.match(/[\(\[]?\s*(?:official\s+)?(?:remix|mix|rmx)\s*[\)\]]?/i);
    if (remixMatch) { isRemix = true; title = title.replace(remixMatch[0], '').trim(); }
    const remixArtistMatch = artist.match(/[\(\[]?\s*(?:official\s+)?(?:remix|mix|rmx)\s*[\)\]]?/i);
    if(remixArtistMatch) { isRemix = true; artist = artist.replace(remixArtistMatch[0], '').trim(); }
    const featInTitleMatch = title.match(/[\(\[]?(?:feat\.?|ft\.?|featuring)\s+([^()\[\]]+)[\)\]]?/i);
    if (featInTitleMatch) { feats.push(...parseFeatList(featInTitleMatch[1])); title = title.replace(featInTitleMatch[0], '').trim(); }
    const featInArtistMatch = artist.match(/(?:feat\.?|ft\.?|featuring)\s+(.+)/i);
    if (featInArtistMatch) { feats.push(...parseFeatList(featInArtistMatch[1])); artist = artist.replace(featInArtistMatch[0], '').trim(); }
    const canSplitSlash = artist.includes('/') && !/^AC\/DC$/i.test(artist.trim());
    const multiArtistPattern = canSplitSlash
        ? /\s*(?:\/|\\|&|\||,|;|\s+x\s+|\s+vs\.?\s+|\s+y\s+)\s*/i
        : /\s*(?:\\|&|\||,|;|\s+x\s+|\s+vs\.?\s+|\s+y\s+)\s*/i;
    if (!isProtectedArtistGroup(artist)) {
        const artistParts = artist.split(multiArtistPattern).map(s => s.trim()).filter(Boolean);
        if (artistParts.length > 1) {
            artist = artistParts[0];
            feats.push(...artistParts.slice(1));
        }
    }
    feats = [...new Set(feats.filter(f => f.length > 0))];
    title = title.replace(/\(\s*\)|\[\s*\]/g, '').replace(/-\s*$/, '').trim();
    return { artist, title, feats, isRemix };
}

function normalizeArtistKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeCountryKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getCountryProfiles() {
    return db.prepare(`
        SELECT country_code AS code, display_name AS name, search_aliases AS aliasesJson
        FROM country_profiles
        ORDER BY display_name COLLATE NOCASE
    `).all().map(row => {
        let aliases = [];
        try { aliases = JSON.parse(row.aliasesJson || '[]'); } catch (err) {}
        return { code: row.code, name: row.name, aliases };
    });
}

function resolveCountryProfile(countryName) {
    const rawName = String(countryName || '').replace(/\s+/g, ' ').trim();
    if (!rawName) return { name: '', code: null };
    const key = normalizeCountryKey(rawName);
    const countries = getCountryProfiles();
    const found = countries.find(country => {
        if (normalizeCountryKey(country.name) === key) return true;
        return (country.aliases || []).some(alias => normalizeCountryKey(alias) === key);
    });
    return found ? { name: found.name, code: found.code } : { name: rawName, code: null };
}

function normalizeNationalitiesList(value) {
    const parts = String(value || '')
        .split(/\s*(?:,|\/|\|)\s*/)
        .map(part => part.trim())
        .filter(Boolean);
    const seen = new Set();
    const names = [];
    const codes = [];
    for (const part of parts) {
        const resolved = resolveCountryProfile(part);
        const name = resolved.name || part;
        const key = normalizeCountryKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        names.push(name);
        if (resolved.code) codes.push(resolved.code);
    }
    return {
        names,
        display: names.join(' / '),
        primaryName: names[0] || '',
        primaryCode: codes[0] || null,
        codes
    };
}

function toDisplayArtist(value) {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean;
}

function parseFeatList(featValue) {
    if (!featValue) return [];
    if (Array.isArray(featValue)) return featValue.map(toDisplayArtist).filter(Boolean);
    if (typeof featValue === 'string') {
        try {
            const parsed = JSON.parse(featValue);
            if (Array.isArray(parsed)) return parsed.map(toDisplayArtist).filter(Boolean);
        } catch (err) {}
        const cleanFeat = toDisplayArtist(featValue);
        if (isProtectedArtistGroup(cleanFeat)) return [cleanFeat];
        return featValue.split(/\s*(?:,|;|\||\/|\\|\s+x\s+|\s+y\s+|\s+vs\.?\s+|&)\s*/i).map(toDisplayArtist).filter(Boolean);
    }
    return [];
}

function filterInternalGroupFeats(mainArtist, feats = []) {
    const cleanMain = toDisplayArtist(mainArtist);
    if (!cleanMain || !isProtectedArtistGroup(cleanMain)) return feats;
    const mainTokens = new Set(normalizeArtistKey(cleanMain).split(' ').filter(token => token && token !== 'y'));
    return (Array.isArray(feats) ? feats : []).filter(featName => {
        const featTokens = normalizeArtistKey(featName).split(' ').filter(token => token && token !== 'y');
        if (featTokens.length === 0) return false;
        return !featTokens.every(token => mainTokens.has(token));
    });
}

function normalizeTrackArtistFields(rawArtist, rawTitle = '', rawFeat = '') {
    const parsed = parseTitleAndArtist(rawArtist || '', rawTitle || '');
    const existingFeats = parseFeatList(rawFeat);
    const feats = filterInternalGroupFeats(parsed.artist || rawArtist, [...new Set([...(existingFeats || []), ...(parsed.feats || [])].map(toDisplayArtist).filter(Boolean))]);
    return {
        artist: parsed.artist || toDisplayArtist(rawArtist),
        title: parsed.title || rawTitle || '',
        feats
    };
}

function parseLeadingArtistCandidate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const split = text.split(/\s+-\s+/);
    if (split.length < 2) return null;
    return parseTitleAndArtist(split[0], split.slice(1).join(' - '));
}

function inferArtistDataFromRow(row) {
    if (!row) return { artist: '', feats: [] };
    const directArtist = toDisplayArtist(row.custom_artist);
    const feats = parseFeatList(row.feat);
    if (directArtist) {
        const parsed = parseTitleAndArtist(directArtist, row.custom_title || '');
        const directKey = normalizeArtistKey(parsed.artist || directArtist);
        const titleCandidate = parseLeadingArtistCandidate(row.custom_title);
        const fileCandidate = parseLeadingArtistCandidate(path.basename(row.file_path || '', path.extname(row.file_path || '')));
        const protectedRecovery = [titleCandidate, fileCandidate].find(candidate => {
            const candidateArtist = candidate?.artist || '';
            if (!candidateArtist || !isProtectedArtistGroup(candidateArtist)) return false;
            const candidateKey = normalizeArtistKey(candidateArtist);
            return candidateKey === directKey || candidateKey.startsWith(`${directKey} `) || candidateKey.includes(` ${directKey} `);
        });
        if (protectedRecovery?.artist) {
            const recoveryFeats = [...new Set([...feats, ...(parsed.feats || []), ...(protectedRecovery.feats || [])])];
            return { artist: protectedRecovery.artist, feats: filterInternalGroupFeats(protectedRecovery.artist, recoveryFeats) };
        }
        const finalArtist = parsed.artist || directArtist;
        return { artist: finalArtist, feats: filterInternalGroupFeats(finalArtist, [...new Set([...feats, ...parsed.feats])]) };
    }

    const baseName = path.basename(row.file_path || '', path.extname(row.file_path || ''));
    const parsed = parseLeadingArtistCandidate(baseName);
    if (parsed) {
        return { artist: parsed.artist || '', feats: filterInternalGroupFeats(parsed.artist, [...new Set([...feats, ...parsed.feats])]) };
    }
    return { artist: '', feats };
}

function upsertArtistProfile(displayName, options = {}) {
    const finalName = toDisplayArtist(displayName);
    const artistKey = normalizeArtistKey(finalName);
    if (!artistKey) return null;
    const now = new Date().toISOString();
    const country = resolveCountryProfile(options.country);
    const countryName = country.name || null;
    const countryCode = country.code || null;
    db.prepare(`
        INSERT INTO artist_profiles (artist_key, display_name, country, country_code, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(artist_key) DO UPDATE SET
            display_name = excluded.display_name,
            country = COALESCE(excluded.country, artist_profiles.country),
            country_code = COALESCE(excluded.country_code, artist_profiles.country_code),
            updated_at = excluded.updated_at
    `).run(artistKey, finalName, countryName, countryCode, now);
    db.prepare(`
        INSERT INTO artist_aliases (alias_key, artist_key, display_name, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(alias_key) DO UPDATE SET
            artist_key = excluded.artist_key,
            display_name = excluded.display_name,
            updated_at = excluded.updated_at
    `).run(artistKey, artistKey, finalName, now);
    return { key: artistKey, displayName: finalName, country: countryName, countryCode };
}

function syncTrackArtistLinks(filePath, artistName, featValue = [], options = {}) {
    if (!filePath) return { linkedArtists: 0 };
    const mainArtist = upsertArtistProfile(artistName, { country: options.country });
    const feats = filterInternalGroupFeats(artistName, parseFeatList(featValue));
    const deleteLinks = db.prepare("DELETE FROM track_artist_links WHERE file_path = ?");
    const insertLink = db.prepare(`
        INSERT OR REPLACE INTO track_artist_links (file_path, artist_key, role, display_name, position)
        VALUES (?, ?, ?, ?, ?)
    `);
    let linkedArtists = 0;
    db.transaction(() => {
        deleteLinks.run(filePath);
        if (mainArtist) {
            insertLink.run(filePath, mainArtist.key, 'main', mainArtist.displayName, 0);
            linkedArtists++;
        }
        feats.forEach((featName, index) => {
            const featArtist = upsertArtistProfile(featName);
            if (!featArtist) return;
            insertLink.run(filePath, featArtist.key, 'feat', featArtist.displayName, index + 1);
            linkedArtists++;
        });
    })();
    return { linkedArtists };
}

function syncTrackArtistLinksFromRow(row) {
    const inferred = inferArtistDataFromRow(row);
    return syncTrackArtistLinks(row?.file_path, inferred.artist, inferred.feats);
}

function rebuildArtistProfilesForPaths(paths = null) {
    const rows = Array.isArray(paths) && paths.length > 0
        ? paths.map(filePath => selectTrackByPathStmt.get(filePath)).filter(Boolean)
        : db.prepare("SELECT * FROM tracks").all();
    let linkedTracks = 0;
    let linkedArtists = 0;
    db.transaction(() => {
        rows.forEach(row => {
            const result = syncTrackArtistLinksFromRow(row);
            if (result.linkedArtists > 0) linkedTracks++;
            linkedArtists += result.linkedArtists;
        });
    })();
    return { linkedTracks, linkedArtists };
}

function getArtistCardByKey(artistKey) {
    if (!artistKey) return null;
    const profile = db.prepare(`
        SELECT
            ap.artist_key AS artistKey,
            ap.display_name AS displayName,
            ap.habitual_genre AS habitualGenre,
            gp.display_name AS habitualGenreName,
            ap.habitual_genres_json AS habitualGenresJson,
            ap.country,
            ap.country_code AS countryCode,
            ap.artist_type AS artistType,
            ap.nationalities,
            ap.main_genre_key AS mainGenreKey,
            main_gp.display_name AS mainGenreName,
            ap.subgenres_csv AS subgenresCsv,
            ap.biography,
            ap.photo_url AS photoUrl,
            ap.photo_local_path AS photoLocalPath,
            ap.external_source AS externalSource,
            ap.external_id AS externalId,
            ap.metadata_fetched_at AS metadataFetchedAt,
            ap.energy_hint AS energyHint,
            ap.notes,
            COUNT(tal.file_path) AS trackCount
        FROM artist_profiles ap
        LEFT JOIN genre_profiles gp ON gp.genre_key = ap.habitual_genre
        LEFT JOIN genre_profiles main_gp ON main_gp.genre_key = ap.main_genre_key
        LEFT JOIN track_artist_links tal ON tal.artist_key = ap.artist_key
        WHERE ap.artist_key = ?
        GROUP BY ap.artist_key
    `).get(artistKey);
    if (!profile) return null;
    const linkedGenres = db.prepare(`
        SELECT COALESCE(gp.display_name, t.genre) AS name, COUNT(*) AS count
        FROM track_artist_links tal
        JOIN tracks t ON t.file_path = tal.file_path
        LEFT JOIN genre_profiles gp ON gp.genre_key = t.primary_genre
        WHERE tal.artist_key = ? AND tal.role = 'main' AND COALESCE(t.genre, t.primary_genre, '') <> ''
        GROUP BY COALESCE(gp.display_name, t.genre)
        ORDER BY count DESC, name COLLATE NOCASE
        LIMIT 8
    `).all(artistKey);
    return { ...profile, linkedGenres };
}

function ensureArtistProfileForLink(displayName) {
    const cleanName = toDisplayArtist(displayName);
    const artistKey = normalizeArtistKey(cleanName);
    if (!artistKey || !cleanName) return null;
    const existing = getArtistCardByKey(artistKey);
    if (existing) return existing;
    const now = new Date().toISOString();
    db.transaction(() => {
        db.prepare(`
            INSERT INTO artist_profiles (artist_key, display_name, artist_type, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(artist_key) DO UPDATE SET
                display_name = excluded.display_name,
                updated_at = excluded.updated_at
        `).run(artistKey, cleanName, null, now);
        db.prepare(`
            INSERT INTO artist_aliases (alias_key, artist_key, display_name, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(alias_key) DO UPDATE SET
                artist_key = excluded.artist_key,
                display_name = excluded.display_name,
                updated_at = excluded.updated_at
        `).run(artistKey, artistKey, cleanName, now);
    })();
    return getArtistCardByKey(artistKey);
}

function getArtistTracksByKey(artistKey) {
    if (!artistKey) return [];
    return db.prepare(`
        SELECT
            t.file_path AS filePath,
            COALESCE(NULLIF(t.custom_title, ''), '') AS customTitle,
            COALESCE(NULLIF(t.custom_artist, ''), '') AS customArtist,
            t.genre,
            t.primary_genre AS primaryGenre,
            t.subgenre,
            t.subgenres_csv AS subgenresCsv,
            t.duration,
            t.file_size AS fileSize,
            t.file_mtime_ms AS fileMtimeMs,
            tal.role,
            tal.position
        FROM track_artist_links tal
        JOIN tracks t ON t.file_path = tal.file_path
        WHERE tal.artist_key = ?
        ORDER BY tal.role = 'main' DESC, COALESCE(NULLIF(t.custom_title, ''), t.file_path) COLLATE NOCASE
    `).all(artistKey).map(row => ({
        ...row,
        title: row.customTitle || path.basename(row.filePath || '', path.extname(row.filePath || '')),
        artist: row.customArtist || '',
        genre: row.genre || '',
        subgenre: row.subgenre || ''
        ,
        subgenresCsv: row.subgenresCsv || ''
    }));
}

function getArtistCardForTrackPath(filePath) {
    if (!filePath) return null;
    let row = selectTrackByPathStmt.get(filePath);
    if (!row) {
        const signature = getTrackFileSignature(filePath);
        db.prepare(`
            INSERT OR IGNORE INTO tracks (file_path, file_size, file_mtime_ms)
            VALUES (?, ?, ?)
        `).run(filePath, signature?.fileSize ?? null, signature?.fileMtimeMs ?? null);
        row = selectTrackByPathStmt.get(filePath) || { file_path: filePath };
    }
    syncTrackArtistLinksFromRow(row);
    const mainLink = db.prepare(`
        SELECT artist_key AS artistKey
        FROM track_artist_links
        WHERE file_path = ? AND role = 'main'
        ORDER BY position
        LIMIT 1
    `).get(filePath);
    return getArtistCardByKey(mainLink?.artistKey);
}

function getArtistCardDetailsForTrackPath(filePath) {
    const card = getArtistCardForTrackPath(filePath);
    if (!card) return null;
    const linkedPaths = new Set(getArtistTracksByKey(card.artistKey).map(track => track.filePath));
    const missingRows = db.prepare(`
        SELECT *
        FROM tracks
        WHERE COALESCE(custom_artist, '') <> ''
           OR COALESCE(custom_title, '') LIKE '% - %'
           OR file_path LIKE '% - %'
    `).all().filter(row => {
        if (!row?.file_path || linkedPaths.has(row.file_path)) return false;
        const inferred = inferArtistDataFromRow(row);
        return normalizeArtistKey(inferred.artist) === card.artistKey;
    });
    missingRows.forEach(row => syncTrackArtistLinksFromRow(row));
    return {
        card,
        tracks: getArtistTracksByKey(card.artistKey)
    };
}

function saveArtistCard(payload = {}) {
    const currentKey = normalizeArtistKey(payload.artistKey || payload.displayName);
    const displayName = toDisplayArtist(payload.displayName);
    if (!currentKey || !displayName) return { success: false, error: 'Artista invalido' };
    const nextKey = normalizeArtistKey(displayName);
    const habitual = String(payload.habitualGenre || '').trim();
    const habitualProfile = habitual ? upsertGenreProfile(habitual) : null;
    const habitualGenresJson = habitualProfile ? JSON.stringify([{ key: habitualProfile.key, name: habitualProfile.displayName, role: 'habitual' }]) : null;
    const mainGenreRaw = String(payload.mainGenre || payload.mainGenreKey || payload.habitualGenre || '').trim();
    const mainGenreProfile = mainGenreRaw && !/^n\/?a/i.test(mainGenreRaw) ? upsertGenreProfile(mainGenreRaw) : null;
    const nationalitiesProfile = normalizeNationalitiesList(payload.nationalities || payload.country);
    const countryName = nationalitiesProfile.primaryName || null;
    const countryCode = nationalitiesProfile.primaryCode || null;
    const notes = String(payload.notes || '').trim() || null;
    const artistType = String(payload.artistType || '').trim() || null;
    const nationalities = nationalitiesProfile.display || countryName;
    const subgenresCsv = cleanCsvList(payload.subgenresCsv || '');
    const biography = String(payload.biography || '').trim() || null;
    const photoUrl = String(payload.photoUrl || '').trim() || null;
    const photoLocalPath = String(payload.photoLocalPath || '').trim() || null;
    const externalSource = String(payload.externalSource || '').trim() || null;
    const externalId = String(payload.externalId || '').trim() || null;
    const metadataFetchedAt = payload.metadataFetchedAt || null;
    const now = new Date().toISOString();

    db.transaction(() => {
        db.prepare(`
            INSERT INTO artist_profiles (
                artist_key, display_name, habitual_genre, habitual_genres_json, country, country_code,
                artist_type, nationalities, main_genre_key, subgenres_csv, biography,
                photo_url, photo_local_path, external_source, external_id, metadata_fetched_at,
                notes, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(artist_key) DO UPDATE SET
                display_name = excluded.display_name,
                habitual_genre = excluded.habitual_genre,
                habitual_genres_json = excluded.habitual_genres_json,
                country = excluded.country,
                country_code = excluded.country_code,
                artist_type = excluded.artist_type,
                nationalities = excluded.nationalities,
                main_genre_key = excluded.main_genre_key,
                subgenres_csv = excluded.subgenres_csv,
                biography = excluded.biography,
                photo_url = excluded.photo_url,
                photo_local_path = COALESCE(excluded.photo_local_path, artist_profiles.photo_local_path),
                external_source = COALESCE(excluded.external_source, artist_profiles.external_source),
                external_id = COALESCE(excluded.external_id, artist_profiles.external_id),
                metadata_fetched_at = COALESCE(excluded.metadata_fetched_at, artist_profiles.metadata_fetched_at),
                notes = excluded.notes,
                updated_at = excluded.updated_at
        `).run(
            nextKey, displayName, habitualProfile?.key || null, habitualGenresJson, countryName, countryCode,
            artistType, nationalities, mainGenreProfile?.key || null, subgenresCsv || null, biography,
            photoUrl || null, photoLocalPath || null, externalSource, externalId, metadataFetchedAt,
            notes, now
        );

        db.prepare(`
            INSERT INTO artist_aliases (alias_key, artist_key, display_name, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(alias_key) DO UPDATE SET
                artist_key = excluded.artist_key,
                display_name = excluded.display_name,
                updated_at = excluded.updated_at
        `).run(currentKey, nextKey, displayName, now);

        if (nextKey !== currentKey) {
            db.prepare("UPDATE track_artist_links SET artist_key = ?, display_name = ? WHERE artist_key = ?").run(nextKey, displayName, currentKey);
            db.prepare("UPDATE artist_aliases SET artist_key = ? WHERE artist_key = ?").run(nextKey, currentKey);
        } else {
            db.prepare("UPDATE track_artist_links SET display_name = ? WHERE artist_key = ?").run(displayName, nextKey);
        }
    })();

    let appliedTracks = 0;
    if (habitualProfile && payload.applyHabitualToMissing === true) {
        const rows = db.prepare(`
            SELECT t.file_path AS filePath
            FROM track_artist_links tal
            JOIN tracks t ON t.file_path = tal.file_path
            WHERE tal.artist_key = ?
              AND tal.role = 'main'
              AND COALESCE(t.genre, t.primary_genre, '') = ''
        `).all(nextKey);
        const result = applyGenreToTrackPaths(rows.map(row => row.filePath), habitualProfile.displayName, '', 'artist-card', '');
        appliedTracks = result.updatedTracks || 0;
    }

    return { success: true, artistKey: nextKey, appliedTracks, card: getArtistCardByKey(nextKey) };
}

function isArtistCurated(row = {}) {
    return !!(
        String(row.artist_type || '').trim()
        && String(row.nationalities || row.country || '').trim()
        && String(row.main_genre_key || row.habitual_genre || '').trim()
        && (String(row.biography || row.notes || '').trim() || String(row.photo_local_path || row.photo_url || '').trim())
    );
}

function getArtistCatalogData() {
    const rows = db.prepare(`
        SELECT
            ap.artist_key AS artistKey,
            ap.display_name AS displayName,
            ap.artist_type,
            ap.nationalities,
            ap.country,
            ap.country_code AS countryCode,
            ap.main_genre_key,
            ap.habitual_genre,
            COALESCE(main_gp.display_name, habit_gp.display_name) AS genreName,
            COALESCE(main_gp.color_hex, habit_gp.color_hex, '#00a8ff') AS genreColor,
            ap.subgenres_csv AS subgenresCsv,
            ap.biography,
            ap.notes,
            ap.photo_local_path AS photoLocalPath,
            ap.photo_url AS photoUrl,
            COUNT(DISTINCT tal.file_path) AS trackCount
        FROM artist_profiles ap
        LEFT JOIN genre_profiles main_gp ON main_gp.genre_key = ap.main_genre_key
        LEFT JOIN genre_profiles habit_gp ON habit_gp.genre_key = ap.habitual_genre
        LEFT JOIN track_artist_links tal ON tal.artist_key = ap.artist_key
        GROUP BY ap.artist_key
        ORDER BY ap.display_name COLLATE NOCASE
    `).all();
    const linkedGenreRows = db.prepare(`
        SELECT
            tal.artist_key AS artistKey,
            COALESCE(NULLIF(t.primary_genre, ''), '') AS genreKey,
            COALESCE(
                NULLIF(gp.display_name, ''),
                NULLIF(TRIM(CASE
                    WHEN INSTR(COALESCE(t.genre, ''), '/') > 0
                    THEN SUBSTR(t.genre, 1, INSTR(t.genre, '/') - 1)
                    ELSE COALESCE(t.genre, '')
                END), ''),
                NULLIF(t.primary_genre, '')
            ) AS genreName,
            COALESCE(gp.color_hex, '#00a8ff') AS genreColor,
            COUNT(DISTINCT tal.file_path) AS trackCount
        FROM track_artist_links tal
        JOIN tracks t ON t.file_path = tal.file_path
        LEFT JOIN genre_profiles gp ON gp.genre_key = t.primary_genre
        WHERE COALESCE(t.primary_genre, '') <> ''
           OR COALESCE(t.genre, '') <> ''
        GROUP BY tal.artist_key, genreKey, genreName, genreColor
        HAVING COALESCE(genreName, '') <> ''
        ORDER BY tal.artist_key, trackCount DESC, genreName COLLATE NOCASE
    `).all();
    const linkedGenresByArtist = new Map();
    linkedGenreRows.forEach(row => {
        if (!linkedGenresByArtist.has(row.artistKey)) linkedGenresByArtist.set(row.artistKey, []);
        linkedGenresByArtist.get(row.artistKey).push({
            key: row.genreKey || '',
            name: row.genreName || 'N/A',
            color: row.genreColor || '#00a8ff',
            count: row.trackCount || 0
        });
    });
    const artists = rows.map(row => ({
        ...row,
        linkedGenres: linkedGenresByArtist.get(row.artistKey) || []
    })).map(row => {
        const dominant = row.linkedGenres[0] || null;
        const curatedGenreName = row.genreName || '';
        const finalGenreName = curatedGenreName || dominant?.name || 'N/A';
        const genreNames = [...new Set([
            finalGenreName,
            ...row.linkedGenres.map(item => item.name)
        ].filter(Boolean))];
        return {
            artistKey: row.artistKey,
            displayName: row.displayName || row.artistKey,
            artistType: row.artist_type || '',
            nationalities: row.nationalities || row.country || '',
            country: row.country || '',
            countryCode: row.countryCode || '',
            genreKey: row.main_genre_key || row.habitual_genre || dominant?.key || '',
            genreName: finalGenreName,
            genreNames,
            genreColor: curatedGenreName ? (row.genreColor || '#00a8ff') : (dominant?.color || '#00a8ff'),
            subgenresCsv: row.subgenresCsv || '',
            photoLocalPath: row.photoLocalPath || '',
            photoUrl: row.photoUrl || '',
            trackCount: row.trackCount || 0,
            curated: isArtistCurated(row)
        };
    });
    const genreCounts = new Map();
    artists.forEach(artist => {
        const names = artist.genreNames?.length ? artist.genreNames : [artist.genreName || 'N/A'];
        names.forEach(name => genreCounts.set(name, (genreCounts.get(name) || 0) + 1));
    });
    return {
        artists,
        genres: [...genreCounts.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        status: {
            all: artists.length,
            curated: artists.filter(artist => artist.curated).length,
            pending: artists.filter(artist => !artist.curated).length
        }
    };
}

function deleteArtistProfiles(artistKeys = []) {
    const keys = [...new Set((Array.isArray(artistKeys) ? artistKeys : []).map(normalizeArtistKey).filter(Boolean))];
    if (!keys.length) return { deleted: 0 };
    const delProfile = db.prepare("DELETE FROM artist_profiles WHERE artist_key = ?");
    const delAlias = db.prepare("DELETE FROM artist_aliases WHERE artist_key = ? OR alias_key = ?");
    const delLinks = db.prepare("DELETE FROM track_artist_links WHERE artist_key = ?");
    db.transaction((items) => {
        for (const key of items) {
            delLinks.run(key);
            delAlias.run(key, key);
            delProfile.run(key);
        }
    })(keys);
    return { deleted: keys.length };
}

function mergeArtistProfiles(targetKeyRaw, sourceKeysRaw = [], options = {}) {
    const targetKey = normalizeArtistKey(targetKeyRaw);
    const sourceKeys = [...new Set((Array.isArray(sourceKeysRaw) ? sourceKeysRaw : []).map(normalizeArtistKey).filter(key => key && key !== targetKey))];
    if (!targetKey || sourceKeys.length === 0) return { merged: 0 };
    const target = getArtistCardByKey(targetKey);
    if (!target) return { merged: 0, error: 'Artista destino no existe.' };
    const targetDisplayName = toDisplayArtist(options.targetDisplayName || target.displayName || targetKey);
    const now = new Date().toISOString();
    db.transaction(() => {
        db.prepare("UPDATE artist_profiles SET display_name = ?, updated_at = ? WHERE artist_key = ?")
            .run(targetDisplayName, now, targetKey);
        db.prepare(`
            INSERT INTO artist_aliases (alias_key, artist_key, display_name, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(alias_key) DO UPDATE SET
                artist_key = excluded.artist_key,
                display_name = excluded.display_name,
                updated_at = excluded.updated_at
        `).run(targetKey, targetKey, targetDisplayName, now);
        for (const sourceKey of sourceKeys) {
            const source = getArtistCardByKey(sourceKey);
            if (!source) continue;
            db.prepare(`
                UPDATE track_artist_links
                SET artist_key = ?, display_name = ?
                WHERE artist_key = ?
            `).run(targetKey, targetDisplayName, sourceKey);
            db.prepare(`
                UPDATE artist_aliases
                SET artist_key = ?
                WHERE artist_key = ?
            `).run(targetKey, sourceKey);
            db.prepare(`
                INSERT INTO artist_aliases (alias_key, artist_key, display_name, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(alias_key) DO UPDATE SET
                    artist_key = excluded.artist_key,
                    display_name = excluded.display_name,
                    updated_at = excluded.updated_at
            `).run(sourceKey, targetKey, source.displayName || sourceKey, now);
            db.prepare("DELETE FROM artist_profiles WHERE artist_key = ?").run(sourceKey);
        }
    })();
    return { merged: sourceKeys.length };
}

function setArtistMainGenreFromCatalog(artistKeysRaw = [], genreNameRaw = '') {
    const artistKeys = [...new Set((Array.isArray(artistKeysRaw) ? artistKeysRaw : []).map(normalizeArtistKey).filter(Boolean))];
    const genreName = String(genreNameRaw || '').trim();
    if (!artistKeys.length) return { updated: 0 };
    if (!genreName || genreName === 'all' || /^n\/?a/i.test(genreName)) return { updated: 0, error: 'Genero invalido.' };
    const genre = upsertGenreProfile(genreName);
    if (!genre?.key) return { updated: 0, error: 'No se pudo crear el genero.' };
    const now = new Date().toISOString();
    const update = db.prepare(`
        UPDATE artist_profiles
        SET main_genre_key = ?,
            habitual_genre = COALESCE(habitual_genre, ?),
            habitual_genres_json = COALESCE(habitual_genres_json, ?),
            updated_at = ?
        WHERE artist_key = ?
    `);
    const genresJson = JSON.stringify([{ key: genre.key, name: genre.displayName, role: 'habitual' }]);
    let updated = 0;
    db.transaction((keys) => {
        for (const artistKey of keys) {
            const info = update.run(genre.key, genre.key, genresJson, now, artistKey);
            updated += info.changes || 0;
        }
    })(artistKeys);
    return { updated, genreKey: genre.key, genreName: genre.displayName };
}

function getArtistImageDir() {
    const fallback = path.join(configDir, 'artists', 'img');
    try {
        const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get('artist_image_dir');
        const configured = String(row?.value || '').trim();
        const finalDir = configured || fallback;
        if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
        return finalDir;
    } catch (err) {
        if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
        return fallback;
    }
}

function safeImageFileName(name, url) {
    const base = normalizeArtistKey(name) || `artist_${Date.now()}`;
    const extFromUrl = String(url || '').split('?')[0].match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || '.jpg';
    return `${base}${extFromUrl.toLowerCase()}`;
}

async function downloadArtistImage(displayName, imageUrl) {
    const url = String(imageUrl || '').trim();
    if (!url) return '';
    const response = await fetch(url, { headers: { 'User-Agent': 'LF_Automatizador/1.0' } });
    if (!response.ok) throw new Error(`No se pudo descargar imagen (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const targetPath = path.join(getArtistImageDir(), safeImageFileName(displayName, url));
    fs.writeFileSync(targetPath, bytes);
    return targetPath;
}

function inferArtistTypeFromMetadata(artistName, musicBrainzArtist = null, audioDbArtist = null) {
    const name = String(artistName || '').toLowerCase();
    const looksLikeDuo = /(?:\s[&+]\s|\s+y\s+|\s+and\s+)/i.test(artistName || '')
        && !/\borquesta\b|\bgrupo\b|\bband\b|\bbanda\b/i.test(artistName || '');
    const mbType = String(musicBrainzArtist?.type || '').toLowerCase();
    const mbGender = String(musicBrainzArtist?.gender || '').toLowerCase();
    const adbGender = String(audioDbArtist?.strGender || '').toLowerCase();
    const adbMembers = Number(audioDbArtist?.intMembers || audioDbArtist?.intMembersTotal || 0);

    if (mbType === 'person') {
        if (mbGender === 'female') return 'Solista (F)';
        if (mbGender === 'male') return 'Solista (M)';
    }
    if (adbGender === 'female') return 'Solista (F)';
    if (adbGender === 'male') return 'Solista (M)';
    if (looksLikeDuo || adbMembers === 2) return 'Duo';
    if (mbType === 'orchestra' || /\borquesta\b/.test(name)) return 'Orquesta';
    if (['group', 'choir'].includes(mbType) || adbMembers > 2) return 'Agrupacion / Banda';
    return '';
}

module.exports = {
  _injectDeps,
  PROTECTED_ARTIST_GROUP_NAMES,
  normalizeArtistGroupKey,
  PROTECTED_ARTIST_GROUP_KEYS,
  isProtectedArtistGroup,
  parseTitleAndArtist,
  normalizeArtistKey,
  normalizeCountryKey,
  getCountryProfiles,
  resolveCountryProfile,
  normalizeNationalitiesList,
  toDisplayArtist,
  parseFeatList,
  filterInternalGroupFeats,
  normalizeTrackArtistFields,
  parseLeadingArtistCandidate,
  inferArtistDataFromRow,
  upsertArtistProfile,
  syncTrackArtistLinks,
  syncTrackArtistLinksFromRow,
  rebuildArtistProfilesForPaths,
  getArtistCardByKey,
  ensureArtistProfileForLink,
  getArtistTracksByKey,
  getArtistCardForTrackPath,
  getArtistCardDetailsForTrackPath,
  saveArtistCard,
  isArtistCurated,
  getArtistCatalogData,
  deleteArtistProfiles,
  mergeArtistProfiles,
  setArtistMainGenreFromCatalog,
  getArtistImageDir,
  safeImageFileName,
  downloadArtistImage,
  inferArtistTypeFromMetadata
};
