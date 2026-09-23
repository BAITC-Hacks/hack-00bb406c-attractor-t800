# Container observations

Final command: `docker compose up -d --build`.

Final container states:

```text
api   Up (healthy)
db    Up (healthy)
web   Up; 127.0.0.1:8080->80
```

Initial startup exposed two seed/schema defects: a required `due_date` that conflicts with the optional CSV field, followed by child history rows being flushed before referenced event rows. Both were corrected; the final Compose startup applied migrations, seeded the full dataset, and passed the health check.
