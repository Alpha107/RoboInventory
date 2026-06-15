<?php
/**
 * RoboInventory v2.0 — db.php
 * Built by Abashesh Ranabhat
 * GitHub: https://github.com/Alpha107
 * © 2026 Abashesh Ranabhat. All rights reserved.
 */

// db.php — SQLite database connection, schema initialisation, and inventory helpers

define('DB_PATH', __DIR__ . '/inventory.db');

function get_db(): PDO {
    static $db = null;
    if ($db === null) {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE,            PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $db->exec("PRAGMA foreign_keys = ON");
        $db->exec("PRAGMA journal_mode = WAL");
    }
    return $db;
}

function init_db(): void {
    $db = get_db();

    $db->exec("
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS component_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_username TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        items TEXT NOT NULL,
        purpose TEXT NOT NULL,
        remarks TEXT DEFAULT '',
        designated_approver TEXT NOT NULL DEFAULT 'Abashesh Ranabhat',
        status TEXT NOT NULL DEFAULT 'pending',
        processed_by TEXT DEFAULT '',
        admin_note TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT DEFAULT '',
        target_type TEXT DEFAULT '',
        target_id INTEGER DEFAULT 0,
        ip_address TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_purchased INTEGER DEFAULT 0,
        used INTEGER DEFAULT 0,
        available INTEGER DEFAULT 0,
        taken_for_use INTEGER DEFAULT 0,
        faulty INTEGER DEFAULT 0,
        sold INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        remark TEXT DEFAULT '',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS faulty_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        component_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        reason TEXT DEFAULT '',
        reported_by TEXT DEFAULT '',
        date TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS retail_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material TEXT NOT NULL,
        retail_cost REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS projects_package (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_name TEXT NOT NULL,
        level TEXT DEFAULT '',
        course TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS package_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects_package(id) ON DELETE CASCADE,
        material TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        price REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS usage_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        instructor TEXT,
        remarks TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS usage_components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usage_id INTEGER REFERENCES usage_timeline(id) ON DELETE CASCADE,
        component TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        returned INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS office_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_name TEXT NOT NULL,
        made_by TEXT DEFAULT '',
        status TEXT DEFAULT 'ongoing',
        remark TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS office_project_components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES office_projects(id) ON DELETE CASCADE,
        component TEXT NOT NULL,
        quantity INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS material_purchase (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        supplier TEXT DEFAULT '',
        item TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price REAL DEFAULT 0,
        total REAL DEFAULT 0,
        invoice_no TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS school_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        supplier TEXT DEFAULT '',
        school_name TEXT NOT NULL,
        remarks TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS school_sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER REFERENCES school_sales(id) ON DELETE CASCADE,
        component TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        price REAL DEFAULT 0
    );
    ");

    // Schema migrations (safe to re-run; ignore already-exists errors)
    foreach ([
        "ALTER TABLE components ADD COLUMN faulty INTEGER DEFAULT 0",
        "ALTER TABLE components ADD COLUMN sold INTEGER DEFAULT 0",
        "ALTER TABLE components ADD COLUMN min_stock INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
        "ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT ''",
    ] as $sql) {
        try { $db->exec($sql); } catch (PDOException $e) { /* already exists */ }
    }

    // Seed env-configured admin
    $adminUser = getenv('ADMIN_USER') ?: 'admin';
    $adminPass = getenv('ADMIN_PASS') ?: 'admin123';

    $s = $db->prepare("SELECT id FROM users WHERE username=?");
    $s->execute([$adminUser]);
    if (!$s->fetch()) {
        $db->prepare("INSERT INTO users(username,full_name,password_hash,role) VALUES(?,?,?,?)")
           ->execute([$adminUser, $adminUser, password_hash($adminPass, PASSWORD_BCRYPT), 'admin']);
    } else {
        $db->prepare("UPDATE users SET role='admin' WHERE username=?")->execute([$adminUser]);
    }

    // Seed named admin accounts
    foreach ([
        ['abashesh', 'Abashesh Ranabhat', 'Abashesh@123'],
        ['surya',    'Surya Bhandari',    'Surya@123'],
    ] as [$uname, $fullname, $passwd]) {
        $s = $db->prepare("SELECT id FROM users WHERE username=?");
        $s->execute([$uname]);
        if (!$s->fetch()) {
            $db->prepare("INSERT INTO users(username,full_name,password_hash,role) VALUES(?,?,?,?)")
               ->execute([$uname, $fullname, password_hash($passwd, PASSWORD_BCRYPT), 'admin']);
        }
    }

    // Seed components
    if ((int)$db->query("SELECT COUNT(*) FROM components")->fetchColumn() === 0) {
        $ins = $db->prepare("INSERT INTO components(name,total_purchased,used,available,taken_for_use,remark) VALUES(?,?,?,?,?,?)");
        foreach ([
            ['Arduino Uno', 130, 102, 28, 0, ''],
            ['ESP 32', 0, 0, 0, 0, ''],
            ['Ultrasonic Sensor', 0, 0, 0, 0, ''],
            ['Relay Module', 0, 0, 0, 0, ''],
            ['Servo Motor', 0, 0, 0, 0, ''],
        ] as $c) { $ins->execute($c); }
    }

    // Seed retail pricing
    if ((int)$db->query("SELECT COUNT(*) FROM retail_pricing")->fetchColumn() === 0) {
        $ins = $db->prepare("INSERT INTO retail_pricing(material,retail_cost) VALUES(?,?)");
        foreach ([
            ['Arduino Uno DIP', 1283], ['Bluetooth Module HC05', 540], ['Relay Module 1CH', 878],
            ['USB Cable (Arduino)', 101], ['Adapter 5V', 270], ['Breadboard Small', 101],
            ['Jumper Wire Set', 189], ['Resistors 2K', 3], ['Resistors 1K', 3], ['Resistor', 3],
            ['LED', 5], ['Screw Driver', 122], ['Hot Glue Gun', 371], ['Hot Stick Big', 16],
            ['104 pf', 5], ['Silicon Wire', 54], ['Black Tape', 34], ['Battery 18650', 189],
            ['Battery Case 3s', 108], ['Battery Case 2s', 101], ['Battery Case 1s', 47],
            ['Battery Charger 18650', 338], ['IR Sensor', 88], ['Ultrasonic Sensor', 189],
            ['L298N Motor Driver', 392], ['Servo Motor', 223], ['Screw Driver Set', 338],
        ] as $p) { $ins->execute($p); }
    }

    // Seed projects package
    if ((int)$db->query("SELECT COUNT(*) FROM projects_package")->fetchColumn() === 0) {
        $db->prepare("INSERT INTO projects_package(project_name,level,course) VALUES(?,?,?)")
           ->execute(['RC Car', 'Intermediate', '30 Days Intermediate']);
        $pid = (int)$db->lastInsertId();
        $ins = $db->prepare("INSERT INTO package_materials(project_id,material,quantity,price) VALUES(?,?,?,?)");
        foreach ([
            ['Arduino Uno', 1, 1283], ['L298N Motor Driver', 1, 392], ['DC Motor', 4, 0],
            ['Robot Chassis', 1, 0], ['Jumper Wires', 1, 189], ['HC05 Bluetooth Module', 1, 540],
            ['Wheels', 4, 0], ['Battery Holder', 1, 0], ['3.7V Li-Ion Battery', 3, 189],
            ['Charger', 1, 338], ['Type-A Cable', 1, 101],
        ] as [$m, $q, $p]) { $ins->execute([$pid, $m, $q, $p]); }
        $db->prepare("INSERT INTO projects_package(project_name,level,course) VALUES(?,?,?)")
           ->execute(['Gesture Controlled Robot', 'Intermediate', '30 Days Intermediate']);
    }

    // Seed office projects
    if ((int)$db->query("SELECT COUNT(*) FROM office_projects")->fetchColumn() === 0) {
        $db->prepare("INSERT INTO office_projects(project_name,made_by,status,remark) VALUES(?,?,?,?)")
           ->execute(['Drone', 'Surya, Abashesh', 'completed', '']);
        $did = (int)$db->lastInsertId();
        $ins = $db->prepare("INSERT INTO office_project_components(project_id,component,quantity) VALUES(?,?,?)");
        foreach ([['BLDC Motor',4],['Drone Frame',1],['Connector Plate',2],['KK2 Controller',1],['ESC',4],['3500 mAH LIPO Battery',1]] as [$c,$q]) {
            $ins->execute([$did, $c, $q]);
        }
        $db->prepare("INSERT INTO office_projects(project_name,made_by,status,remark) VALUES(?,?,?,?)")
           ->execute(['Remote Control Car', 'Abashesh', 'completed', '']);
        $rid = (int)$db->lastInsertId();
        foreach ([['Arduino Uno',1],['HC05',1],['BO Motor',1],['L298N Motor Driver',1],['Jumper Wires',1],['Battery Holder',1],['Battery',1]] as [$c,$q]) {
            $ins->execute([$rid, $c, $q]);
        }
    }

    // Seed usage timeline
    if ((int)$db->query("SELECT COUNT(*) FROM usage_timeline")->fetchColumn() === 0) {
        $db->prepare("INSERT INTO usage_timeline(date,instructor,remarks) VALUES(?,?,?)")
           ->execute(['2026-03-09', 'Surya', 'Taken for Self Practice']);
        $uid = (int)$db->lastInsertId();
        $ins = $db->prepare("INSERT INTO usage_components(usage_id,component,quantity,returned) VALUES(?,?,?,?)");
        foreach ([['Arduino Uno',1,0],['Ultrasonic Sensor',2,0],['BO Motor',4,0],['Motor Driver',1,0]] as [$c,$q,$r]) {
            $ins->execute([$uid, $c, $q, $r]);
        }
    }
}

// ── Inventory helpers ─────────────────────────────────────────────────────────

function db_avail(array $row, ?int $oTotal=null, ?int $oUsed=null, ?int $oTaken=null, ?int $oFaulty=null, ?int $oSold=null): int {
    $t = $oTotal  ?? (int)($row['total_purchased'] ?? 0);
    $u = $oUsed   ?? (int)($row['used']            ?? 0);
    $k = $oTaken  ?? (int)($row['taken_for_use']   ?? 0);
    $f = $oFaulty ?? (int)($row['faulty']          ?? 0);
    $s = $oSold   ?? (int)($row['sold']            ?? 0);
    return max(0, $t - $u - $k - $f - $s);
}

function fetch_comp(PDO $db, string $name): ?array {
    $s = $db->prepare("SELECT id,total_purchased,used,taken_for_use,faulty,sold FROM components WHERE LOWER(name)=LOWER(?)");
    $s->execute([$name]);
    return $s->fetch() ?: null;
}

function sync_purchase(PDO $db, string $item, int $qty): void {
    $row = fetch_comp($db, $item);
    $now = date('Y-m-d H:i:s');
    if ($row) {
        $nt = (int)$row['total_purchased'] + $qty;
        $db->prepare("UPDATE components SET total_purchased=?,available=?,updated_at=? WHERE id=?")
           ->execute([$nt, db_avail($row, $nt), $now, $row['id']]);
    } else {
        $db->prepare("INSERT INTO components(name,total_purchased,used,available,taken_for_use,faulty,remark,updated_at) VALUES(?,?,0,?,0,0,'',?)")
           ->execute([$item, $qty, $qty, $now]);
    }
}

function undo_purchase(PDO $db, string $item, int $qty): void {
    $row = fetch_comp($db, $item);
    if ($row) {
        $nt = max(0, (int)$row['total_purchased'] - $qty);
        $db->prepare("UPDATE components SET total_purchased=?,available=?,updated_at=? WHERE id=?")
           ->execute([$nt, db_avail($row, $nt), date('Y-m-d H:i:s'), $row['id']]);
    }
}

function adjust_taken(PDO $db, string $name, int $qty, int $dir): void {
    $row = fetch_comp($db, $name);
    if ($row) {
        $nk = max(0, (int)$row['taken_for_use'] + $dir * $qty);
        $db->prepare("UPDATE components SET taken_for_use=?,available=?,updated_at=? WHERE id=?")
           ->execute([$nk, db_avail($row, null, null, $nk), date('Y-m-d H:i:s'), $row['id']]);
    }
}

function adjust_faulty(PDO $db, string $name, int $qty, int $dir): void {
    $row = fetch_comp($db, $name);
    if ($row) {
        $nf = max(0, (int)$row['faulty'] + $dir * $qty);
        $db->prepare("UPDATE components SET faulty=?,available=?,updated_at=? WHERE id=?")
           ->execute([$nf, db_avail($row, null, null, null, $nf), date('Y-m-d H:i:s'), $row['id']]);
    }
}

function adjust_sold(PDO $db, string $name, int $qty, int $dir): void {
    $row = fetch_comp($db, $name);
    if ($row) {
        $ns = max(0, (int)$row['sold'] + $dir * $qty);
        $db->prepare("UPDATE components SET sold=?,available=?,updated_at=? WHERE id=?")
           ->execute([$ns, db_avail($row, null, null, null, null, $ns), date('Y-m-d H:i:s'), $row['id']]);
    }
}

function mark_used(PDO $db, array $comps): void {
    foreach ($comps as $c) {
        $row = fetch_comp($db, $c['component']);
        if ($row) {
            $nu = (int)$row['used'] + (int)($c['quantity'] ?? 1);
            $db->prepare("UPDATE components SET used=?,available=?,updated_at=? WHERE id=?")
               ->execute([$nu, db_avail($row, null, $nu), date('Y-m-d H:i:s'), $row['id']]);
        }
    }
}

function unmark_used(PDO $db, array $comps): void {
    foreach ($comps as $c) {
        $row = fetch_comp($db, $c['component']);
        if ($row) {
            $nu = max(0, (int)$row['used'] - (int)($c['quantity'] ?? 1));
            $db->prepare("UPDATE components SET used=?,available=?,updated_at=? WHERE id=?")
               ->execute([$nu, db_avail($row, null, $nu), date('Y-m-d H:i:s'), $row['id']]);
        }
    }
}

function log_action(PDO $db, string $actor, string $action, string $details='', string $targetType='', int $targetId=0): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $db->prepare("INSERT INTO activity_log(actor,action,details,target_type,target_id,ip_address) VALUES(?,?,?,?,?,?)")
       ->execute([$actor, $action, $details, $targetType, $targetId, $ip]);
}
