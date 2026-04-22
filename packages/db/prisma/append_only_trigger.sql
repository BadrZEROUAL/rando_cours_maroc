-- ============================================================
-- Migration manuelle : trigger APPEND ONLY sur transactions
-- À exécuter dans Supabase SQL Editor après prisma migrate
-- ============================================================

-- Fonction qui bloque tout UPDATE et DELETE sur transactions
CREATE OR REPLACE FUNCTION prevent_transaction_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'La table transactions est APPEND ONLY. UPDATE et DELETE sont interdits. (transaction_id: %)',
    OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger UPDATE
CREATE TRIGGER trg_transactions_no_update
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_transaction_modification();

-- Trigger DELETE
CREATE TRIGGER trg_transactions_no_delete
  BEFORE DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_transaction_modification();

-- Vérification : tester le trigger
-- INSERT INTO transactions (id, type, source_id, dest_id, montant_rc)
-- VALUES (gen_random_uuid(), 'CREDIT_DH', 'test', 'test', 1000);
-- UPDATE transactions SET montant_rc = 9999 WHERE id = '...'; -- Doit échouer
-- DELETE FROM transactions WHERE id = '...'; -- Doit échouer

-- Commentaire de documentation
COMMENT ON TABLE transactions IS
  'Table APPEND ONLY — protégée par triggers prevent_transaction_modification. '
  'Obligations fiscales Maroc : conserver 5 ans minimum (Loi 09-08).';
