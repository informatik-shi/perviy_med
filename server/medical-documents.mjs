import { handleStudentDocuments } from "./payment-documents.mjs";

export async function initMedicalDocuments(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS medical_documents (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    kind ENUM('results','green_card','clearance') NOT NULL,
    file_name VARCHAR(190) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    file_data MEDIUMBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_medical_student (user_id, created_at),
    CONSTRAINT fk_medical_student FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [columns] = await pool.query("SHOW COLUMNS FROM medical_documents LIKE 'kind'");
  if (!columns[0].Type.includes("'clearance'")) {
    await pool.query("ALTER TABLE medical_documents MODIFY kind ENUM('results','green_card','clearance') NOT NULL");
  }
}

export function handleMedicalDocuments(request, response, url, user, pool) {
  return handleStudentDocuments(request, response, url, user, pool, {
    root: "/api/medical-documents", table: "medical_documents", studentKinds: ["results", "green_card", "clearance"], adminKinds: [],
  });
}
