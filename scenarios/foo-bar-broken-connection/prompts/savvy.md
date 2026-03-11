Debug a broken Postgres setup:

1. The Python script at /workspace/load_data.py has hardcoded credentials that don't match the running Postgres instance.
2. The init SQL at /workspace/init.sql has a syntax error on the CREATE TABLE statement.
3. Environment variable POSTGRES_URL is set but contains a wrong port number.

Fix all three issues so that:
- The init SQL creates the `app.users` table successfully
- The Python script connects using environment variables (not hardcoded creds)
- Data loads into `app.users` with 5 rows
