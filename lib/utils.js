export function generateUserId(existingIds) {
  let id;
  do {
    id = String(Math.floor(10000 + Math.random() * 90000)); // 5 หลัก
  } while (existingIds.includes(id));
  return id;
}

export function generateToken() {
  return String(Math.floor(10000 + Math.random() * 90000)); // 5 หลักสุ่ม
}

