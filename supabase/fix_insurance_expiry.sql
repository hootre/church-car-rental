-- insurance_expiry가 "MM-DD" 형식(5글자)인 경우 앞에 "2026-"을 붙여서 "2026-MM-DD"로 수정
UPDATE vehicles
SET insurance_expiry = '2026-' || insurance_expiry
WHERE insurance_expiry IS NOT NULL
  AND LENGTH(insurance_expiry) = 5
  AND insurance_expiry LIKE '__-__';
