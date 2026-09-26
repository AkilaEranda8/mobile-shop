# Hexalyte PostgreSQL runtime hardening (included via -c flags in compose).
# Kept as documentation of the intended settings.

# listen: container network only (host publish is 127.0.0.1 in compose)
# password_encryption=scram-sha-256
# log_connections=on
# log_disconnections=on
# log_statement=ddl
# shared_preload_libraries= (none required)
