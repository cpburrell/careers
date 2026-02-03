set -e

echo ""
echo "== careers: ensuring app role exists =="
echo "  stage: roles/users"

: "${CAREERS_DB_USER:=careers}"
: "${CAREERS_DB_PASSWORD:=careers}"

careers_user_esc=$(printf "%s" "$CAREERS_DB_USER" | sed "s/'/''/g")
careers_password_esc=$(printf "%s" "$CAREERS_DB_PASSWORD" | sed "s/'/''/g")

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  <<SQL
DO \$\$
DECLARE
  careers_user text := '${careers_user_esc}';
  careers_password text := '${careers_password_esc}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = careers_user) THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', careers_user, careers_password);
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', careers_user, careers_password);
  END IF;
END \$\$;
SQL

echo "== careers: app role ready =="
