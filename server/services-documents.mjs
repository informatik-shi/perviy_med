import { handleStudentDocuments } from "./payment-documents.mjs";

export async function initServicesDocuments(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS services_documents (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    kind ENUM('snils') NOT NULL,
    file_name VARCHAR(190) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    file_data MEDIUMBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_services_student (user_id, created_at),
    CONSTRAINT fk_services_student FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export function handleServicesDocuments(request, response, url, user, pool) {
  return handleStudentDocuments(request, response, url, user, pool, {
    root: "/api/services-documents", table: "services_documents", studentKinds: ["snils"], adminKinds: [],
  });
}
