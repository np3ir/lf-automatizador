/**
 * genre_data.js — Acceso a datos de géneros (CAPA 2)
 * Solo SQL, sin lógica de negocio.
 */
const { normalizeSlug } = require('./genre_utils');

let db;
function _setDb(injectedDb) { db = injectedDb; }

function findGenreBySlug(slug) {
    return db.prepare(`
        SELECT g.id, g.slug, g.display_name AS displayName, g.parent_id AS parentId,
               g.energy_level AS energyLevel, g.search_anchors AS searchAnchors,
               g.sort_order AS sortOrder, g.is_active AS isActive,
               p.display_name AS parentName, p.slug AS parentSlug
        FROM genre_profiles g
        LEFT JOIN genre_profiles p ON p.id = g.parent_id
        WHERE g.slug = ?
    `).get(slug) || null;
}

function findGenreById(id) {
    return db.prepare(`
        SELECT g.id, g.slug, g.display_name AS displayName, g.parent_id AS parentId,
               g.energy_level AS energyLevel, g.search_anchors AS searchAnchors,
               g.sort_order AS sortOrder, g.is_active AS isActive,
               p.display_name AS parentName, p.slug AS parentSlug
        FROM genre_profiles g
        LEFT JOIN genre_profiles p ON p.id = g.parent_id
        WHERE g.id = ?
    `).get(id) || null;
}

function insertGenre(slug, displayName, parentId = null) {
    const now = new Date().toISOString();
    const result = db.prepare(`
        INSERT INTO genre_profiles (slug, display_name, parent_id, energy_level, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 2, 1, ?, ?)
    `).run(slug, displayName, parentId, now, now);
    return result.lastInsertRowid;
}

function updateGenre(id, fields) {
    const now = new Date().toISOString();
    const sets = [];
    const values = [];
    if (fields.displayName !== undefined) { sets.push('display_name = ?'); values.push(fields.displayName); }
    if (fields.parentId !== undefined) { sets.push('parent_id = ?'); values.push(fields.parentId); }
    if (fields.energyLevel !== undefined) { sets.push('energy_level = ?'); values.push(fields.energyLevel); }
    if (fields.searchAnchors !== undefined) { sets.push('search_anchors = ?'); values.push(fields.searchAnchors); }
    if (fields.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(fields.sortOrder); }
    if (fields.slug !== undefined) { sets.push('slug = ?'); values.push(fields.slug); }
    if (sets.length === 0) return false;
    sets.push('updated_at = ?'); values.push(now);
    values.push(id);
    db.prepare(`UPDATE genre_profiles SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return true;
}

function deactivateGenre(id) {
    const now = new Date().toISOString();
    db.prepare("UPDATE genre_profiles SET is_active = 0, updated_at = ? WHERE id = ?").run(now, id);
    return true;
}

function getAllActiveGenres() {
    return db.prepare(`
        SELECT g.id, g.slug, g.display_name AS displayName, g.parent_id AS parentId,
               g.energy_level AS energyLevel, g.search_anchors AS searchAnchors,
               g.sort_order AS sortOrder,
               p.display_name AS parentName, p.slug AS parentSlug
        FROM genre_profiles g
        LEFT JOIN genre_profiles p ON p.id = g.parent_id
        WHERE g.is_active = 1
        ORDER BY g.display_name COLLATE NOCASE
    `).all();
}

function getTrackCountsByGenreId() {
    const rows = db.prepare(`
        SELECT genre_id, COUNT(*) as total FROM track_genre_links GROUP BY genre_id
    `).all();
    const map = new Map();
    rows.forEach(r => map.set(r.genre_id, r.total));
    return map;
}

function getUnidentifiedGenres(activeIds) {
    const rawRows = db.prepare(`
        SELECT val, COUNT(*) as total FROM (
            SELECT genre as val FROM tracks WHERE COALESCE(genre, '') <> ''
            UNION ALL
            SELECT subgenre as val FROM tracks WHERE COALESCE(subgenre, '') <> ''
        ) GROUP BY val
    `).all();

    const unidentified = new Map();
    for (const row of rawRows) {
        const name = row.val.trim();
        if (!name || name.includes('/') || name.includes(';')) continue;
        const slug = normalizeSlug(name);
        if (!slug || activeIds.has(slug)) continue;
        if (unidentified.has(slug)) {
            unidentified.get(slug).trackCount += row.total;
        } else {
            unidentified.set(slug, { slug, displayName: name, trackCount: row.total });
        }
    }
    return [...unidentified.values()];
}

function getTrackPathsForGenreId(genreId) {
    return db.prepare(`
        SELECT file_path AS filePath FROM track_genre_links WHERE genre_id = ?
    `).all(genreId).map(r => r.filePath);
}

function getTracksForGenreDisplay(genreId, genre) {
    if (!genre) return [];
    const displayName = genre.displayName;
    const slug = genre.slug;
    return db.prepare(`
        SELECT DISTINCT
            t.file_path AS filePath,
            COALESCE(NULLIF(t.custom_title, ''), '') AS title,
            COALESCE(NULLIF(t.custom_artist, ''), '') AS artist,
            t.genre, t.year
        FROM tracks t
        LEFT JOIN track_genre_links tgl ON tgl.file_path = t.file_path
        WHERE tgl.genre_id = ?
           OR t.genre = ? COLLATE NOCASE
           OR t.primary_genre = ? COLLATE NOCASE
        ORDER BY artist COLLATE NOCASE, title COLLATE NOCASE
        LIMIT 500
    `).all(genreId, displayName, slug);
}

function linkTrackToGenre(filePath, genreId, role, source) {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT OR REPLACE INTO track_genre_links (file_path, genre_id, role, source, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(filePath, genreId, role, source, now);
}

function unlinkAllGenresFromTrack(filePath) {
    db.prepare("DELETE FROM track_genre_links WHERE file_path = ?").run(filePath);
}

function moveLinksToGenre(fromGenreId, toGenreId) {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT OR IGNORE INTO track_genre_links (file_path, genre_id, role, source, created_at)
        SELECT file_path, ?, role, 'merge', ? FROM track_genre_links WHERE genre_id = ?
    `).run(toGenreId, now, fromGenreId);
    db.prepare("DELETE FROM track_genre_links WHERE genre_id = ?").run(fromGenreId);
}

function updateChildrenParent(oldParentId, newParentId) {
    const now = new Date().toISOString();
    db.prepare("UPDATE genre_profiles SET parent_id = ?, updated_at = ? WHERE parent_id = ?")
        .run(newParentId, now, oldParentId);
}

module.exports = {
    _setDb,
    findGenreBySlug, findGenreById,
    insertGenre, updateGenre, deactivateGenre,
    getAllActiveGenres, getTrackCountsByGenreId, getUnidentifiedGenres,
    getTrackPathsForGenreId, getTracksForGenreDisplay,
    linkTrackToGenre, unlinkAllGenresFromTrack,
    moveLinksToGenre, updateChildrenParent
};
