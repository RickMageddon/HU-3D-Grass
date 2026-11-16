# Dashboard backend deployment

Create the required secrets outside Git and place them in the backend `.env`:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32
```

Use the first two values for `JWT_SECRET` and
`CAMERA_STREAM_TICKET_SECRET`. Use the base64 value for
`SMART_MODULE_KEY_ENCRYPTION_KEY`. Losing the encryption key makes existing
module credentials unreadable; back it up in the same protected location as
the production database.

Install `atum3d-backend.service`, incorporate the Nginx snippet and validate
both configurations before restarting:

```bash
sudo systemctl daemon-reload
sudo nginx -t
sudo systemctl restart atum3d-backend
```
