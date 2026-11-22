-- N18 Approval 2A: durable, scoped safety controls; synthetic-only sandbox migration.
-- No record deletion, live import, contact merge or external system changes.
ALTER TABLE crm.safety ADD COLUMN IF NOT EXISTS route_normalised_value text;
ALTER TABLE crm.safety ADD COLUMN IF NOT EXISTS organisation_key text;
ALTER TABLE crm.safety ADD COLUMN IF NOT EXISTS evidence_recorded_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE crm.safety ADD COLUMN IF NOT EXISTS clearance_evidence text;

UPDATE crm.safety s
SET route_normalised_value = lower(btrim(r.normalised_value))
FROM crm.contact_routes r
WHERE s.contact_route_id = r.id AND s.route_normalised_value IS NULL;

UPDATE crm.safety s
SET organisation_key = lower(btrim(coalesce(nullif(o.canonical_domain, ''), o.canonical_name)))
FROM crm.organisations o
WHERE s.organisation_id = o.id AND s.organisation_key IS NULL;

ALTER TABLE crm.safety DROP CONSTRAINT IF EXISTS safety_contact_id_contacts_id_fk;
ALTER TABLE crm.safety DROP CONSTRAINT IF EXISTS safety_contact_route_id_contact_routes_id_fk;
ALTER TABLE crm.safety DROP CONSTRAINT IF EXISTS safety_organisation_id_organisations_id_fk;
ALTER TABLE crm.safety DROP CONSTRAINT IF EXISTS safety_subscriber_id_subscribers_id_fk;
ALTER TABLE crm.safety ADD CONSTRAINT safety_contact_id_contacts_id_fk
  FOREIGN KEY (contact_id) REFERENCES crm.contacts(id) ON DELETE SET NULL;
ALTER TABLE crm.safety ADD CONSTRAINT safety_contact_route_id_contact_routes_id_fk
  FOREIGN KEY (contact_route_id) REFERENCES crm.contact_routes(id) ON DELETE SET NULL;
ALTER TABLE crm.safety ADD CONSTRAINT safety_organisation_id_organisations_id_fk
  FOREIGN KEY (organisation_id) REFERENCES crm.organisations(id) ON DELETE SET NULL;
ALTER TABLE crm.safety ADD CONSTRAINT safety_subscriber_id_subscribers_id_fk
  FOREIGN KEY (subscriber_id) REFERENCES crm.subscribers(id) ON DELETE SET NULL;

ALTER TABLE crm.safety DROP CONSTRAINT IF EXISTS safety_has_scope_target_ck;
ALTER TABLE crm.safety ADD CONSTRAINT safety_has_scope_target_ck CHECK (
  organisation_id IS NOT NULL OR contact_id IS NOT NULL OR contact_route_id IS NOT NULL
  OR subscriber_id IS NOT NULL OR route_normalised_value IS NOT NULL OR organisation_key IS NOT NULL
);
ALTER TABLE crm.safety ADD CONSTRAINT safety_durable_control_ck CHECK (
  safety_type NOT IN ('marketing_objection','failed_route')
  OR route_normalised_value IS NOT NULL OR organisation_key IS NOT NULL
);
CREATE INDEX IF NOT EXISTS safety_route_lookup_idx ON crm.safety (status, channel, route_normalised_value);
CREATE INDEX IF NOT EXISTS safety_organisation_lookup_idx ON crm.safety (status, organisation_key);
CREATE UNIQUE INDEX IF NOT EXISTS safety_active_identity_uq ON crm.safety (
  scope_type, safety_type, coalesce(channel,''), coalesce(purpose,''),
  coalesce(route_normalised_value,''), coalesce(organisation_key,''),
  coalesce(organisation_id::text,''), coalesce(contact_id::text,'')
) WHERE status = 'active';
