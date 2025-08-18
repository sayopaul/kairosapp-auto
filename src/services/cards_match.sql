
DECLARE
  clean_name1 TEXT;
  clean_name2 TEXT;
BEGIN
  -- Handle null inputs
  IF name1 IS NULL OR name2 IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Clean and normalize names
  clean_name1 := LOWER(TRIM(name1));
  clean_name2 := LOWER(TRIM(name2));
  
  -- Exact match
  IF clean_name1 = clean_name2 THEN
    RETURN TRUE;
  END IF;
  
  -- Fuzzy match using contains logic
  IF clean_name1 LIKE '%' || clean_name2 || '%' OR 
     clean_name2 LIKE '%' || clean_name1 || '%' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
