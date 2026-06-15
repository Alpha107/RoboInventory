<?php
/**
 * RoboInventory v2.0 — index.php
 * Built by Abashesh Ranabhat
 * GitHub: https://github.com/Alpha107
 * © 2026 Abashesh Ranabhat. All rights reserved.
 */

// ── Built-in server: serve static files directly ─────────────────────────────
if (PHP_SAPI === 'cli-server') {
    $reqUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if ($reqUri !== '/' && file_exists(__DIR__ . $reqUri) && is_file(__DIR__ . $reqUri)) {
        return false;
    }
}

// ── Load .env ─────────────────────────────────────────────────────────────────
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line[0] === '#') continue;
        [$k, $v] = array_map('trim', explode('=', $line, 2) + [1 => '']);
        if ($k) putenv("$k=$v");
    }
}

// ── Session ───────────────────────────────────────────────────────────────────
session_set_cookie_params(['lifetime' => 28800, 'httponly' => true, 'samesite' => 'Lax', 'path' => '/']);
session_start();

require_once __DIR__ . '/db.php';

// ── CORS ──────────────────────────────────────────────────────────────────────
$allowedOrigins = array_map('trim', explode(',', getenv('ALLOWED_ORIGINS') ?: 'http://localhost:8080'));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, X-CSRF-Token");
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') { http_response_code(204); exit; }

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// ── Page routes ───────────────────────────────────────────────────────────────
if ($uri === '/' || $uri === '') {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/pages/login.html');
    exit;
}
if ($uri === '/dashboard') {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/pages/dashboard.html');
    exit;
}

// ── JSON API ──────────────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=UTF-8');

// Parse request body
$body = [];
$raw = file_get_contents('php://input');
if ($raw) $body = json_decode($raw, true) ?? [];

// Helpers
function jout(mixed $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function require_auth(): bool {
    if (empty($_SESSION['user'])) { jout(['error' => 'Unauthorized'], 401); }
    global $method;
    if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!$token || $token !== ($_SESSION['csrf_token'] ?? '')) {
            jout(['error' => 'CSRF token invalid'], 403);
        }
    }
    return true;
}

function require_admin(): bool {
    require_auth();
    if (($_SESSION['role'] ?? '') !== 'admin') jout(['error' => 'Admin access required'], 403);
    return true;
}

// Rate limiter (file-based, per-IP)
function rate_ok(string $ip): bool {
    $file = sys_get_temp_dir() . '/ri_rate_' . md5($ip) . '.json';
    $now = time();
    $data = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
    if (!empty($data) && $now < ($data['reset_at'] ?? 0) && ($data['count'] ?? 0) >= 10) return false;
    return true;
}
function rate_record(string $ip, bool $success): void {
    $file = sys_get_temp_dir() . '/ri_rate_' . md5($ip) . '.json';
    if ($success) { @unlink($file); return; }
    $now  = time();
    $data = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : ['count' => 0, 'reset_at' => $now + 300];
    if ($now >= ($data['reset_at'] ?? 0)) $data = ['count' => 0, 'reset_at' => $now + 300];
    $data['count']++;
    file_put_contents($file, json_encode($data));
}

// ── Route dispatch ─────────────────────────────────────────────────────────────
$parts = array_values(array_filter(explode('/', $uri)));
// parts: ['api', 'components', '123'] etc.

if (($parts[0] ?? '') !== 'api') jout(['error' => 'Not found'], 404);

init_db();
$db = get_db();

$res  = $parts[1] ?? '';   // components / pricing / usage / …
$seg2 = $parts[2] ?? '';   // id or sub-resource (dedup / reorder / return / pending-count)
$seg3 = $parts[3] ?? '';   // for /api/usage/{id}/return-all or /api/usage/return/{ucid}
$id   = ctype_digit($seg2) ? (int)$seg2 : null;
$id3  = ctype_digit($seg3) ? (int)$seg3 : null;

switch ($res) {

    // ── AUTH ─────────────────────────────────────────────────────────────────
    case 'login':
        if ($method !== 'POST') jout(['error' => 'Method not allowed'], 405);
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        if (!rate_ok($ip)) jout(['error' => 'Too many failed attempts. Try again in 5 minutes.'], 429);
        $uname = trim($body['username'] ?? '');
        $pass  = $body['password']  ?? '';
        $s = $db->prepare("SELECT * FROM users WHERE username=?");
        $s->execute([$uname]);
        $user = $s->fetch();
        if ($user && password_verify($pass, $user['password_hash'])) {
            rate_record($ip, true);
            $_SESSION['user']       = $user['username'];
            $_SESSION['role']       = $user['role'] ?: 'user';
            $_SESSION['full_name']  = $user['full_name'] ?: $user['username'];
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            log_action($db, $user['username'], 'login', "Login from $ip");
            jout(['success' => true, 'username' => $user['username'], 'role' => $_SESSION['role'], 'full_name' => $_SESSION['full_name']]);
        }
        rate_record($ip, false);
        jout(['error' => 'Invalid credentials'], 401);

    case 'logout':
        session_destroy();
        jout(['success' => true]);

    case 'me':
        if (empty($_SESSION['user'])) jout(['error' => 'Not logged in'], 401);
        jout(['username' => $_SESSION['user'], 'role' => $_SESSION['role'] ?? 'user',
              'full_name' => $_SESSION['full_name'] ?? $_SESSION['user'],
              'csrf_token' => $_SESSION['csrf_token'] ?? '']);

    case 'change-password':
        require_auth();
        $s = $db->prepare("SELECT * FROM users WHERE username=?");
        $s->execute([$_SESSION['user']]);
        $user = $s->fetch();
        if (!$user || !password_verify($body['old_password'] ?? '', $user['password_hash']))
            jout(['error' => 'Current password incorrect'], 400);
        $db->prepare("UPDATE users SET password_hash=? WHERE username=?")
           ->execute([password_hash($body['new_password'] ?? '', PASSWORD_BCRYPT), $_SESSION['user']]);
        jout(['success' => true]);

    // ── DASHBOARD ─────────────────────────────────────────────────────────────
    case 'dashboard':
        require_auth();
        $q = fn($sql) => $db->query($sql)->fetchColumn();
        $recentUsage = $db->query("
            SELECT u.date, u.instructor, u.remarks,
                   GROUP_CONCAT(uc.component||' x'||uc.quantity, ', ') as items
            FROM usage_timeline u LEFT JOIN usage_components uc ON u.id=uc.usage_id
            GROUP BY u.id ORDER BY u.created_at DESC LIMIT 5")->fetchAll();
        $pricingRows = $db->query("SELECT material,retail_cost FROM retail_pricing ORDER BY retail_cost DESC LIMIT 8")->fetchAll();
        $compRows    = $db->query("SELECT name,available,used FROM components LIMIT 8")->fetchAll();
        jout([
            'total_components'     => (int)$q("SELECT COUNT(*) FROM components"),
            'total_inventory_value'=> (float)$db->query("
                SELECT COALESCE(
                    NULLIF((SELECT SUM(total) FROM material_purchase), 0),
                    (SELECT COALESCE(SUM(
                        c.total_purchased * COALESCE(
                            (SELECT r.retail_cost FROM retail_pricing r
                             WHERE LOWER(TRIM(c.name)) LIKE '%'||LOWER(TRIM(r.material))||'%'
                                OR LOWER(TRIM(r.material)) LIKE '%'||LOWER(TRIM(c.name))||'%'
                             ORDER BY LENGTH(r.material) DESC LIMIT 1),
                        0)), 0)
                     FROM components c),
                    0
                )")->fetchColumn(),
            'total_projects'       => (int)$q("SELECT COUNT(*) FROM office_projects"),
            'ongoing'              => (int)$q("SELECT COUNT(*) FROM office_projects WHERE status='ongoing'"),
            'upcoming'             => (int)$q("SELECT COUNT(*) FROM office_projects WHERE status='upcoming'"),
            'completed'            => (int)$q("SELECT COUNT(*) FROM office_projects WHERE status='completed'"),
            'low_stock'            => (int)$q("SELECT COUNT(*) FROM components WHERE min_stock > 0 AND available <= min_stock"),
            'total_items_purchased'=> (int)$q("SELECT COALESCE(SUM(total_purchased),0) FROM components"),
            'total_available'      => (int)$q("SELECT COALESCE(SUM(available),0) FROM components"),
            'total_faulty'         => (int)$q("SELECT COALESCE(SUM(faulty),0) FROM components"),
            'faulty_entries'       => (int)$q("SELECT COUNT(*) FROM faulty_log WHERE status='active'"),
            'total_sold'           => (int)$q("SELECT COALESCE(SUM(sold),0) FROM components"),
            'recent_usage'         => $recentUsage,
            'pricing_chart'        => $pricingRows,
            'comp_chart'           => $compRows,
        ]);

    // ── COMPONENTS ────────────────────────────────────────────────────────────
    case 'components':
        require_auth();

        // POST /api/components/dedup
        if ($seg2 === 'dedup' && $method === 'POST') {
            require_admin();
            $rows   = $db->query("SELECT * FROM components ORDER BY id")->fetchAll();
            $groups = [];
            foreach ($rows as $r) $groups[strtolower(trim($r['name']))][] = $r;
            $merged = 0;
            foreach ($groups as $dupes) {
                if (count($dupes) < 2) continue;
                $keep = $dupes[0];
                $tp = array_sum(array_column($dupes, 'total_purchased'));
                $u  = array_sum(array_column($dupes, 'used'));
                $tf = array_sum(array_column($dupes, 'taken_for_use'));
                $f  = array_sum(array_column($dupes, 'faulty'));
                $s  = array_sum(array_column($dupes, 'sold'));
                $a  = max(0, $tp - $u - $tf - $f - $s);
                $rem = array_filter($dupes, fn($d) => $d['remark']);
                $remark = $rem ? array_values($rem)[0]['remark'] : '';
                $db->prepare("UPDATE components SET total_purchased=?,used=?,available=?,taken_for_use=?,faulty=?,sold=?,remark=?,updated_at=? WHERE id=?")
                   ->execute([$tp, $u, $a, $tf, $f, $s, $remark, date('Y-m-d H:i:s'), $keep['id']]);
                foreach (array_slice($dupes, 1) as $d) {
                    $db->prepare("DELETE FROM components WHERE id=?")->execute([$d['id']]);
                }
                $merged += count($dupes) - 1;
            }
            jout(['success' => true, 'merged' => $merged]);
        }

        // GET /api/components/reorder
        if ($seg2 === 'reorder' && $method === 'GET') {
            $rows = $db->query("SELECT * FROM components WHERE available <= min_stock ORDER BY available ASC")->fetchAll();
            jout($rows);
        }

        // PUT/DELETE /api/components/{id}
        if ($id !== null) {
            require_admin();
            if ($method === 'DELETE') {
                $db->prepare("DELETE FROM components WHERE id=?")->execute([$id]);
                jout(['success' => true]);
            }
            if ($method === 'PUT') {
                $tp = (int)($body['total_purchased'] ?? 0); $u = (int)($body['used'] ?? 0);
                $tf = (int)($body['taken_for_use']  ?? 0); $f = (int)($body['faulty'] ?? 0);
                $s  = (int)($body['sold']           ?? 0); $ms = (int)($body['min_stock'] ?? 0);
                if ($u + $tf + $f + $s > $tp)
                    jout(['error' => "Used + Taken + Faulty + Sold (".($u+$tf+$f+$s).") cannot exceed Total Purchased ($tp)."], 400);
                $a = max(0, $tp - $u - $tf - $f - $s);
                $db->prepare("UPDATE components SET name=?,total_purchased=?,used=?,available=?,taken_for_use=?,faulty=?,sold=?,min_stock=?,remark=?,updated_at=? WHERE id=?")
                   ->execute([$body['name'], $tp, $u, $a, $tf, $f, $s, $ms, $body['remark'] ?? '', date('Y-m-d H:i:s'), $id]);
                jout(['success' => true]);
            }
        }

        // GET/POST /api/components
        if ($method === 'GET') {
            $q = $body['q'] ?? ($_GET['q'] ?? '');
            $rows = $db->prepare("SELECT * FROM components WHERE name LIKE ? ORDER BY id");
            $rows->execute(["%$q%"]);
            jout($rows->fetchAll());
        }
        if ($method === 'POST') {
            require_admin();
            $tp = (int)($body['total_purchased'] ?? 0); $u = (int)($body['used'] ?? 0);
            $tf = (int)($body['taken_for_use']  ?? 0); $f = (int)($body['faulty'] ?? 0);
            $s  = (int)($body['sold']           ?? 0);
            $ex = $db->prepare("SELECT * FROM components WHERE LOWER(name)=LOWER(?)");
            $ex->execute([$body['name']]);
            $existing = $ex->fetch();
            $now = date('Y-m-d H:i:s');
            if ($existing) {
                $ntp = (int)$existing['total_purchased'] + $tp;
                $nu  = (int)$existing['used']            + $u;
                $ntf = (int)$existing['taken_for_use']   + $tf;
                $nf  = (int)$existing['faulty']          + $f;
                $ns  = (int)$existing['sold']            + $s;
                $a   = max(0, $ntp - $nu - $ntf - $nf - $ns);
                $db->prepare("UPDATE components SET total_purchased=?,used=?,available=?,taken_for_use=?,faulty=?,sold=?,remark=?,updated_at=? WHERE id=?")
                   ->execute([$ntp, $nu, $a, $ntf, $nf, $ns, $body['remark'] ?? $existing['remark'] ?? '', $now, $existing['id']]);
            } else {
                $a = max(0, $tp - $u - $tf - $f - $s);
                $db->prepare("INSERT INTO components(name,total_purchased,used,available,taken_for_use,faulty,sold,remark,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
                   ->execute([$body['name'], $tp, $u, $a, $tf, $f, $s, $body['remark'] ?? '', $now]);
            }
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── RETAIL PRICING ────────────────────────────────────────────────────────
    case 'pricing':
        require_auth();
        if ($id !== null) {
            require_admin();
            if ($method === 'DELETE') { $db->prepare("DELETE FROM retail_pricing WHERE id=?")->execute([$id]); jout(['success' => true]); }
            if ($method === 'PUT') {
                $db->prepare("UPDATE retail_pricing SET material=?,retail_cost=? WHERE id=?")
                   ->execute([$body['material'], (float)($body['retail_cost'] ?? 0), $id]);
                jout(['success' => true]);
            }
        }
        if ($method === 'GET') {
            $q = $_GET['q'] ?? '';
            $s = $db->prepare("SELECT * FROM retail_pricing WHERE material LIKE ? ORDER BY id");
            $s->execute(["%$q%"]);
            jout($s->fetchAll());
        }
        if ($method === 'POST') {
            require_admin();
            $db->prepare("INSERT INTO retail_pricing(material,retail_cost) VALUES(?,?)")
               ->execute([$body['material'], (float)($body['retail_cost'] ?? 0)]);
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── PROJECTS PACKAGE ──────────────────────────────────────────────────────
    case 'packages':
        require_auth();
        if ($id !== null) {
            require_admin();
            if ($method === 'DELETE') { $db->prepare("DELETE FROM projects_package WHERE id=?")->execute([$id]); jout(['success' => true]); }
            if ($method === 'PUT') {
                $db->prepare("UPDATE projects_package SET project_name=?,level=?,course=? WHERE id=?")
                   ->execute([$body['project_name'], $body['level'] ?? '', $body['course'] ?? '', $id]);
                $db->prepare("DELETE FROM package_materials WHERE project_id=?")->execute([$id]);
                $ins = $db->prepare("INSERT INTO package_materials(project_id,material,quantity,price) VALUES(?,?,?,?)");
                foreach ($body['materials'] ?? [] as $m) $ins->execute([$id, $m['material'], (int)($m['quantity']??1), (float)($m['price']??0)]);
                jout(['success' => true]);
            }
        }
        if ($method === 'GET') {
            $rows = $db->query("SELECT * FROM projects_package ORDER BY id")->fetchAll();
            foreach ($rows as &$r) {
                $ms = $db->prepare("SELECT * FROM package_materials WHERE project_id=?");
                $ms->execute([$r['id']]);
                $r['materials'] = $ms->fetchAll();
                $r['total'] = array_sum(array_map(fn($m) => (float)$m['price'] * (int)$m['quantity'], $r['materials']));
            }
            jout($rows);
        }
        if ($method === 'POST') {
            require_admin();
            $db->prepare("INSERT INTO projects_package(project_name,level,course) VALUES(?,?,?)")
               ->execute([$body['project_name'], $body['level'] ?? '', $body['course'] ?? '']);
            $pid = (int)$db->lastInsertId();
            $ins = $db->prepare("INSERT INTO package_materials(project_id,material,quantity,price) VALUES(?,?,?,?)");
            foreach ($body['materials'] ?? [] as $m) $ins->execute([$pid, $m['material'], (int)($m['quantity']??1), (float)($m['price']??0)]);
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── USAGE TIMELINE ────────────────────────────────────────────────────────
    case 'usage':
        require_auth();

        // PUT /api/usage/return/{ucid}  (toggle single component return)
        if ($seg2 === 'return' && $id3 !== null && $method === 'PUT') {
            $cur = $db->prepare("SELECT component,quantity,returned FROM usage_components WHERE id=?");
            $cur->execute([$id3]);
            $uc = $cur->fetch();
            if ($uc) {
                $nowR = $uc['returned'] ? 0 : 1;
                $db->prepare("UPDATE usage_components SET returned=? WHERE id=?")->execute([$nowR, $id3]);
                adjust_taken($db, $uc['component'], (int)$uc['quantity'], $nowR ? -1 : +1);
            }
            jout(['success' => true]);
        }

        // PUT /api/usage/{id}/return-all
        if ($id !== null && $seg3 === 'return-all' && $method === 'PUT') {
            $unreturned = $db->prepare("SELECT id,component,quantity FROM usage_components WHERE usage_id=? AND returned=0");
            $unreturned->execute([$id]);
            $cnt = 0;
            foreach ($unreturned->fetchAll() as $uc) {
                $db->prepare("UPDATE usage_components SET returned=1 WHERE id=?")->execute([$uc['id']]);
                adjust_taken($db, $uc['component'], (int)$uc['quantity'], -1);
                $cnt++;
            }
            jout(['success' => true, 'returned_count' => $cnt]);
        }

        // PUT/DELETE /api/usage/{id}
        if ($id !== null && in_array($method, ['PUT','DELETE'])) {
            $oldComps = $db->prepare("SELECT component,quantity,returned FROM usage_components WHERE usage_id=?");
            $oldComps->execute([$id]);
            $oldComps = $oldComps->fetchAll();
            foreach ($oldComps as $oc) if (!$oc['returned']) adjust_taken($db, $oc['component'], (int)$oc['quantity'], -1);
            if ($method === 'DELETE') {
                $db->prepare("DELETE FROM usage_timeline WHERE id=?")->execute([$id]);
            } else {
                $db->prepare("UPDATE usage_timeline SET date=?,instructor=?,remarks=? WHERE id=?")
                   ->execute([$body['date'] ?? '', $body['instructor'] ?? '', $body['remarks'] ?? '', $id]);
                $db->prepare("DELETE FROM usage_components WHERE usage_id=?")->execute([$id]);
                $ins = $db->prepare("INSERT INTO usage_components(usage_id,component,quantity,returned) VALUES(?,?,?,?)");
                foreach ($body['components'] ?? [] as $c) {
                    $ins->execute([$id, $c['component'], (int)($c['quantity']??1), (int)($c['returned']??0)]);
                    if (!($c['returned']??0)) adjust_taken($db, $c['component'], (int)($c['quantity']??1), +1);
                }
            }
            jout(['success' => true]);
        }

        // GET /api/usage
        if ($method === 'GET') {
            $rows = $db->query("SELECT * FROM usage_timeline ORDER BY date DESC, id DESC")->fetchAll();
            foreach ($rows as &$r) {
                $cs = $db->prepare("SELECT * FROM usage_components WHERE usage_id=?");
                $cs->execute([$r['id']]);
                $r['components'] = $cs->fetchAll();
            }
            jout($rows);
        }

        // POST /api/usage
        if ($method === 'POST') {
            foreach ($body['components'] ?? [] as $c) {
                if (!($c['returned']??0)) {
                    $comp = fetch_comp($db, $c['component']);
                    if ($comp) {
                        $av = db_avail($comp);
                        if ((int)($c['quantity']??1) > $av)
                            jout(['error' => "Only $av unit(s) of \"{$c['component']}\" available."], 400);
                    }
                }
            }
            $db->prepare("INSERT INTO usage_timeline(date,instructor,remarks) VALUES(?,?,?)")
               ->execute([$body['date'] ?? '', $body['instructor'] ?? '', $body['remarks'] ?? '']);
            $uid = (int)$db->lastInsertId();
            $ins = $db->prepare("INSERT INTO usage_components(usage_id,component,quantity,returned) VALUES(?,?,?,?)");
            foreach ($body['components'] ?? [] as $c) {
                $ins->execute([$uid, $c['component'], (int)($c['quantity']??1), (int)($c['returned']??0)]);
                if (!($c['returned']??0)) adjust_taken($db, $c['component'], (int)($c['quantity']??1), +1);
            }
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── OFFICE PROJECTS ───────────────────────────────────────────────────────
    case 'projects':
        require_auth();
        if ($id !== null) {
            require_admin();
            $oldProj  = $db->prepare("SELECT status FROM office_projects WHERE id=?");
            $oldProj->execute([$id]);
            $oldProj  = $oldProj->fetch();
            $oldComps = $db->prepare("SELECT component,quantity FROM office_project_components WHERE project_id=?");
            $oldComps->execute([$id]);
            $oldComps = $oldComps->fetchAll();
            $oldStatus = $oldProj['status'] ?? 'ongoing';
            if ($method === 'DELETE') {
                if ($oldStatus === 'completed') unmark_used($db, $oldComps);
                $db->prepare("DELETE FROM office_projects WHERE id=?")->execute([$id]);
            } else {
                $newStatus = $body['status'] ?? 'ongoing';
                $newComps  = $body['components'] ?? [];
                if ($oldStatus === 'completed') unmark_used($db, $oldComps);
                $db->prepare("UPDATE office_projects SET project_name=?,made_by=?,status=?,remark=? WHERE id=?")
                   ->execute([$body['project_name'], $body['made_by'] ?? '', $newStatus, $body['remark'] ?? '', $id]);
                $db->prepare("DELETE FROM office_project_components WHERE project_id=?")->execute([$id]);
                $ins = $db->prepare("INSERT INTO office_project_components(project_id,component,quantity) VALUES(?,?,?)");
                foreach ($newComps as $c) $ins->execute([$id, $c['component'], (int)($c['quantity']??1)]);
                if ($newStatus === 'completed') mark_used($db, $newComps);
            }
            jout(['success' => true]);
        }
        if ($method === 'GET') {
            $status = $_GET['status'] ?? '';
            $sql = "SELECT * FROM office_projects" . ($status ? " WHERE status=?" : '') . " ORDER BY id DESC";
            $s = $db->prepare($sql);
            $s->execute($status ? [$status] : []);
            $rows = $s->fetchAll();
            foreach ($rows as &$r) {
                $cs = $db->prepare("SELECT * FROM office_project_components WHERE project_id=?");
                $cs->execute([$r['id']]);
                $r['components'] = $cs->fetchAll();
            }
            jout($rows);
        }
        if ($method === 'POST') {
            require_admin();
            $status = $body['status'] ?? 'ongoing';
            $db->prepare("INSERT INTO office_projects(project_name,made_by,status,remark) VALUES(?,?,?,?)")
               ->execute([$body['project_name'], $body['made_by'] ?? '', $status, $body['remark'] ?? '']);
            $pid   = (int)$db->lastInsertId();
            $comps = $body['components'] ?? [];
            $ins   = $db->prepare("INSERT INTO office_project_components(project_id,component,quantity) VALUES(?,?,?)");
            foreach ($comps as $c) $ins->execute([$pid, $c['component'], (int)($c['quantity']??1)]);
            if ($status === 'completed') mark_used($db, $comps);
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── MATERIAL PURCHASE ─────────────────────────────────────────────────────
    case 'purchases':
        require_auth();
        if ($id !== null) {
            require_admin();
            $old = $db->prepare("SELECT item,quantity FROM material_purchase WHERE id=?");
            $old->execute([$id]);
            $old = $old->fetch();
            if ($method === 'DELETE') {
                if ($old) undo_purchase($db, $old['item'], (int)$old['quantity']);
                $db->prepare("DELETE FROM material_purchase WHERE id=?")->execute([$id]);
            } else {
                $nqty  = (int)($body['quantity'] ?? 1);
                $total = $nqty * (float)($body['unit_price'] ?? 0);
                if ($old) undo_purchase($db, $old['item'], (int)$old['quantity']);
                $db->prepare("UPDATE material_purchase SET date=?,supplier=?,item=?,quantity=?,unit_price=?,total=?,invoice_no=?,notes=? WHERE id=?")
                   ->execute([$body['date']??'', $body['supplier']??'', $body['item'], $nqty, (float)($body['unit_price']??0), $total, $body['invoice_no']??'', $body['notes']??'', $id]);
                sync_purchase($db, $body['item'], $nqty);
            }
            jout(['success' => true]);
        }
        if ($method === 'GET') {
            $q = $_GET['q'] ?? '';
            $s = $db->prepare("SELECT * FROM material_purchase WHERE item LIKE ? OR supplier LIKE ? ORDER BY date DESC, id DESC");
            $s->execute(["%$q%", "%$q%"]);
            jout($s->fetchAll());
        }
        if ($method === 'POST') {
            require_admin();
            $qty   = (int)($body['quantity'] ?? 1);
            $total = $qty * (float)($body['unit_price'] ?? 0);
            $db->prepare("INSERT INTO material_purchase(date,supplier,item,quantity,unit_price,total,invoice_no,notes) VALUES(?,?,?,?,?,?,?,?)")
               ->execute([$body['date']??'', $body['supplier']??'', $body['item'], $qty, (float)($body['unit_price']??0), $total, $body['invoice_no']??'', $body['notes']??'']);
            sync_purchase($db, $body['item'], $qty);
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── FAULTY ITEMS ──────────────────────────────────────────────────────────
    case 'faulty':
        require_auth();
        if ($id !== null) {
            require_admin();
            $old = $db->prepare("SELECT component_name,quantity,status FROM faulty_log WHERE id=?");
            $old->execute([$id]);
            $old = $old->fetch();
            if ($method === 'DELETE') {
                if ($old && $old['status'] === 'active') adjust_faulty($db, $old['component_name'], (int)$old['quantity'], -1);
                $db->prepare("DELETE FROM faulty_log WHERE id=?")->execute([$id]);
            } else {
                $nqty   = (int)($body['quantity'] ?? 1);
                $nstatus = $body['status'] ?? 'active';
                if ($old && $old['status'] === 'active') adjust_faulty($db, $old['component_name'], (int)$old['quantity'], -1);
                $db->prepare("UPDATE faulty_log SET component_name=?,quantity=?,reason=?,reported_by=?,date=?,status=? WHERE id=?")
                   ->execute([$body['component_name'], $nqty, $body['reason']??'', $body['reported_by']??'', $body['date']??'', $nstatus, $id]);
                if ($nstatus === 'active') adjust_faulty($db, $body['component_name'], $nqty, +1);
            }
            jout(['success' => true]);
        }
        if ($method === 'GET') {
            $q = $_GET['q'] ?? '';
            $s = $db->prepare("SELECT * FROM faulty_log WHERE component_name LIKE ? ORDER BY date DESC, id DESC");
            $s->execute(["%$q%"]);
            jout($s->fetchAll());
        }
        if ($method === 'POST') {
            require_admin();
            $qty     = (int)($body['quantity'] ?? 1);
            $status  = $body['status'] ?? 'active';
            if ($status === 'active') {
                $comp = fetch_comp($db, $body['component_name']);
                if ($comp) {
                    $av = db_avail($comp);
                    if ($qty > $av) jout(['error' => "Only $av unit(s) of \"{$body['component_name']}\" available. Cannot mark $qty as faulty."], 400);
                }
            }
            $db->prepare("INSERT INTO faulty_log(component_name,quantity,reason,reported_by,date,status) VALUES(?,?,?,?,?,?)")
               ->execute([$body['component_name'], $qty, $body['reason']??'', $body['reported_by']??'', $body['date']??'', $status]);
            if ($status === 'active') adjust_faulty($db, $body['component_name'], $qty, +1);
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── SOLD TO SCHOOL ────────────────────────────────────────────────────────
    case 'schools':
        require_auth();
        if ($id !== null) {
            require_admin();
            $oldItems = $db->prepare("SELECT component,quantity FROM school_sale_items WHERE sale_id=?");
            $oldItems->execute([$id]);
            foreach ($oldItems->fetchAll() as $it) adjust_sold($db, $it['component'], (int)$it['quantity'], -1);
            if ($method === 'DELETE') {
                $db->prepare("DELETE FROM school_sales WHERE id=?")->execute([$id]);
            } else {
                $db->prepare("UPDATE school_sales SET date=?,supplier=?,school_name=?,remarks=? WHERE id=?")
                   ->execute([$body['date']??'', $body['supplier']??'', $body['school_name'], $body['remarks']??'', $id]);
                $db->prepare("DELETE FROM school_sale_items WHERE sale_id=?")->execute([$id]);
                $ins = $db->prepare("INSERT INTO school_sale_items(sale_id,component,quantity,price) VALUES(?,?,?,?)");
                foreach ($body['items'] ?? [] as $it) {
                    $ins->execute([$id, $it['component'], (int)($it['quantity']??1), (float)($it['price']??0)]);
                    adjust_sold($db, $it['component'], (int)($it['quantity']??1), +1);
                }
            }
            jout(['success' => true]);
        }
        if ($method === 'GET') {
            $rows = $db->query("SELECT * FROM school_sales ORDER BY created_at DESC")->fetchAll();
            foreach ($rows as &$r) {
                $is = $db->prepare("SELECT * FROM school_sale_items WHERE sale_id=?");
                $is->execute([$r['id']]);
                $r['items'] = $is->fetchAll();
                $r['total'] = array_sum(array_map(fn($i) => (int)$i['quantity'] * (float)$i['price'], $r['items']));
            }
            jout($rows);
        }
        if ($method === 'POST') {
            require_admin();
            foreach ($body['items'] ?? [] as $it) {
                $comp = fetch_comp($db, $it['component']);
                if ($comp) {
                    $av = db_avail($comp);
                    if ((int)($it['quantity']??1) > $av) jout(['error' => "Only $av unit(s) of \"{$it['component']}\" available to sell."], 400);
                }
            }
            $db->prepare("INSERT INTO school_sales(date,supplier,school_name,remarks) VALUES(?,?,?,?)")
               ->execute([$body['date']??'', $body['supplier']??'', $body['school_name'], $body['remarks']??'']);
            $sid = (int)$db->lastInsertId();
            $ins = $db->prepare("INSERT INTO school_sale_items(sale_id,component,quantity,price) VALUES(?,?,?,?)");
            foreach ($body['items'] ?? [] as $it) {
                $ins->execute([$sid, $it['component'], (int)($it['quantity']??1), (float)($it['price']??0)]);
                adjust_sold($db, $it['component'], (int)($it['quantity']??1), +1);
            }
            jout(['success' => true]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── USERS (admin) ─────────────────────────────────────────────────────────
    case 'users':
        require_admin();
        if ($id !== null) {
            $row = $db->prepare("SELECT username FROM users WHERE id=?");
            $row->execute([$id]);
            $row = $row->fetch();
            if (!$row) jout(['error' => 'User not found'], 404);
            if ($method === 'DELETE') {
                if ($row['username'] === ($_SESSION['user'] ?? '')) jout(['error' => 'Cannot delete your own account'], 400);
                $db->prepare("DELETE FROM users WHERE id=?")->execute([$id]);
                log_action($db, $_SESSION['user'], 'user_deleted', "Deleted user '{$row['username']}'", 'user', $id);
                jout(['success' => true]);
            }
            if ($method === 'PUT') {
                $fn   = trim($body['full_name'] ?? '');
                $role = $body['role'] ?? 'user';
                $sets = ['full_name=?', 'role=?'];
                $vals = [$fn, $role];
                if (!empty($body['new_password'])) {
                    $sets[] = 'password_hash=?';
                    $vals[] = password_hash($body['new_password'], PASSWORD_BCRYPT);
                }
                $vals[] = $id;
                $db->prepare("UPDATE users SET " . implode(',', $sets) . " WHERE id=?")->execute($vals);
                log_action($db, $_SESSION['user'], 'user_updated', "Updated user '{$row['username']}'", 'user', $id);
                jout(['success' => true]);
            }
        }
        if ($method === 'GET') {
            $s = $db->query("SELECT id,username,full_name,role,created_at FROM users ORDER BY role DESC,created_at");
            jout($s->fetchAll());
        }
        if ($method === 'POST') {
            $uname = trim($body['username'] ?? '');
            $fn    = trim($body['full_name'] ?? '');
            $pass  = $body['password'] ?? '';
            $role  = in_array($body['role'] ?? '', ['admin','user']) ? $body['role'] : 'user';
            if (!$uname || !$pass) jout(['error' => 'Username and password required'], 400);
            try {
                $db->prepare("INSERT INTO users(username,full_name,password_hash,role) VALUES(?,?,?,?)")
                   ->execute([$uname, $fn, password_hash($pass, PASSWORD_BCRYPT), $role]);
                log_action($db, $_SESSION['user'], 'user_created', "Created user '$uname' ($role)", 'user');
                jout(['success' => true]);
            } catch (PDOException $e) {
                jout(['error' => 'Username already exists'], 400);
            }
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── COMPONENT REQUESTS ────────────────────────────────────────────────────
    case 'requests':
        require_auth();

        // GET /api/requests/pending-count
        if ($seg2 === 'pending-count') {
            require_admin();
            $cnt = $db->query("SELECT COUNT(*) FROM component_requests WHERE status='pending'")->fetchColumn();
            jout(['count' => (int)$cnt]);
        }

        // PUT/DELETE /api/requests/{id}
        if ($id !== null && in_array($method, ['PUT','DELETE'])) {
            require_admin();
            $req = $db->prepare("SELECT * FROM component_requests WHERE id=?");
            $req->execute([$id]);
            $req = $req->fetch();
            if (!$req) jout(['error' => 'Request not found'], 404);
            if ($method === 'DELETE') {
                $db->prepare("DELETE FROM component_requests WHERE id=?")->execute([$id]);
                log_action($db, $_SESSION['user'], 'request_deleted', "Deleted request #$id", 'request', $id);
                jout(['success' => true]);
            }
            // PUT: approve or reject
            $action    = $body['action'] ?? '';
            $processor = $_SESSION['full_name'] ?? $_SESSION['user'];
            $now       = date('Y-m-d H:i:s');
            if ($action === 'approve') {
                if ($req['status'] !== 'pending') jout(['error' => 'Only pending requests can be approved'], 400);
                $items = json_decode($req['items'], true) ?? [];
                foreach ($items as $it) {
                    $comp = $db->prepare("SELECT available FROM components WHERE LOWER(name)=LOWER(?)");
                    $comp->execute([$it['name']]);
                    $comp = $comp->fetch();
                    if (!$comp) jout(['error' => "Component '{$it['name']}' not found in inventory"], 400);
                    if ((int)$comp['available'] < (int)$it['qty'])
                        jout(['error' => "Not enough stock for '{$it['name']}': {$comp['available']} available, {$it['qty']} requested"], 400);
                }
                $today = date('Y-m-d');
                $db->prepare("INSERT INTO usage_timeline(date,instructor,remarks) VALUES(?,?,?)")
                   ->execute([$today, $req['requester_name'], "Request #$id: {$req['purpose']}"]);
                $uid = (int)$db->lastInsertId();
                $ins = $db->prepare("INSERT INTO usage_components(usage_id,component,quantity,returned) VALUES(?,?,?,0)");
                foreach ($items as $it) {
                    $ins->execute([$uid, $it['name'], (int)$it['qty']]);
                    adjust_taken($db, $it['name'], (int)$it['qty'], +1);
                }
                $db->prepare("UPDATE component_requests SET status='approved',processed_by=?,updated_at=? WHERE id=?")
                   ->execute([$processor, $now, $id]);
                log_action($db, $_SESSION['user'], 'request_approved', "Approved request #$id from {$req['requester_name']}", 'request', $id);
            } elseif ($action === 'reject') {
                $note = trim($body['admin_note'] ?? '');
                $db->prepare("UPDATE component_requests SET status='rejected',processed_by=?,admin_note=?,updated_at=? WHERE id=?")
                   ->execute([$processor, $note, $now, $id]);
                log_action($db, $_SESSION['user'], 'request_rejected', "Rejected request #$id: $note", 'request', $id);
            } else {
                jout(['error' => 'Invalid action. Use approve or reject'], 400);
            }
            jout(['success' => true]);
        }

        // GET /api/requests
        if ($method === 'GET') {
            if (($_SESSION['role'] ?? '') === 'admin') {
                $rows = $db->query("SELECT * FROM component_requests ORDER BY created_at DESC")->fetchAll();
            } else {
                $s = $db->prepare("SELECT * FROM component_requests WHERE requester_username=? ORDER BY created_at DESC");
                $s->execute([$_SESSION['user']]);
                $rows = $s->fetchAll();
            }
            jout($rows);
        }

        // POST /api/requests
        if ($method === 'POST') {
            $items   = $body['items'] ?? [];
            $purpose = trim($body['purpose'] ?? '');
            if (!$items || !$purpose) jout(['error' => 'Items and purpose are required'], 400);
            $designated = $body['designated_approver'] ?? 'Abashesh Ranabhat';
            $db->prepare("INSERT INTO component_requests(requester_username,requester_name,items,purpose,remarks,designated_approver) VALUES(?,?,?,?,?,?)")
               ->execute([$_SESSION['user'], $_SESSION['full_name'] ?? $_SESSION['user'], json_encode($items), $purpose, $body['remarks']??'', $designated]);
            $rid = (int)$db->lastInsertId();
            log_action($db, $_SESSION['user'], 'request_submitted', "Submitted request #$rid: $purpose", 'request', $rid);
            jout(['success' => true, 'id' => $rid]);
        }
        jout(['error' => 'Method not allowed'], 405);

    // ── ACTIVITY LOG ──────────────────────────────────────────────────────────
    case 'logs':
        require_admin();
        $limit  = min((int)($_GET['limit'] ?? 300), 1000);
        $actor  = $_GET['actor']  ?? '';
        $action = $_GET['action'] ?? '';
        $where  = []; $params = [];
        if ($actor)  { $where[] = 'actor=?';  $params[] = $actor; }
        if ($action) { $where[] = 'action=?'; $params[] = $action; }
        $clause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $params[] = $limit;
        $s = $db->prepare("SELECT * FROM activity_log $clause ORDER BY created_at DESC LIMIT ?");
        $s->execute($params);
        $actors = $db->query("SELECT DISTINCT actor FROM activity_log ORDER BY actor")->fetchAll(PDO::FETCH_COLUMN);
        jout(['logs' => $s->fetchAll(), 'actors' => $actors]);

    // ── CSV EXPORTS ───────────────────────────────────────────────────────────
    case 'export':
        require_auth();
        if ($seg2 === 'components') {
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="components.csv"');
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Component','Total Purchased','Used','Available','Taken for Use','Faulty','Sold','Min Stock','Remark']);
            $rows = $db->query("SELECT name,total_purchased,used,available,taken_for_use,faulty,sold,min_stock,remark FROM components ORDER BY name")->fetchAll();
            foreach ($rows as $r) fputcsv($out, array_values($r));
            fclose($out);
            exit;
        }
        if ($seg2 === 'purchases') {
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="purchases.csv"');
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date','Supplier','Item','Quantity','Unit Price (NPR)','Total (NPR)','Invoice No','Notes']);
            $rows = $db->query("SELECT date,supplier,item,quantity,unit_price,total,invoice_no,notes FROM material_purchase ORDER BY date DESC")->fetchAll();
            foreach ($rows as $r) fputcsv($out, array_values($r));
            fclose($out);
            exit;
        }
        jout(['error' => 'Not found'], 404);

    // ── DATABASE BACKUP ────────────────────────────────────────────────────────
    case 'admin':
        require_auth();
        if ($seg2 === 'backup') {
            $ts   = date('Ymd_His');
            $dest = sys_get_temp_dir() . "/inventory_backup_{$ts}.db";
            copy(DB_PATH, $dest);
            header('Content-Type: application/octet-stream');
            header("Content-Disposition: attachment; filename=\"inventory_backup_{$ts}.db\"");
            header('Content-Length: ' . filesize($dest));
            readfile($dest);
            @unlink($dest);
            exit;
        }
        jout(['error' => 'Not found'], 404);

    default:
        jout(['error' => 'Not found'], 404);
}
