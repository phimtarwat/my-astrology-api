export function generateUserId() {
  // สุ่มตัวเลข 5 หลัก
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function generateToken() {
  // สุ่มตัวเลข 5 หลัก
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function getExpiry() {
  // กำหนดหมดอายุ = วันนี้ + 30 วัน
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export function getQuota(packageId) {
  // quota ตาม package
  const map = {
    premium: 30,
    standard: 10,
    lite: 5,
  };
  return map[packageId] || 0;
}
