import { handleStudentDocuments } from "./payment-documents.mjs";

export async function initMigrationDocuments(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS migration_documents (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    kind ENUM('visa','ticket','registration') NOT NULL,
    file_name VARCHAR(190) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    file_data MEDIUMBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_migration_student (user_id, kind, created_at),
    CONSTRAINT fk_migration_student FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [columns] = await pool.query("SHOW COLUMNS FROM migration_documents LIKE 'kind'");
  if (!columns[0].Type.includes("'registration'")) {
    await pool.query("ALTER TABLE migration_documents MODIFY kind ENUM('visa','ticket','registration') NOT NULL");
  }
}

export function handleMigrationDocuments(request, response, url, user, pool) {
  return handleStudentDocuments(request, response, url, user, pool, {
    root: "/api/migration-documents", table: "migration_documents", studentKinds: ["visa", "ticket", "registration"], adminKinds: [],
  });
}
