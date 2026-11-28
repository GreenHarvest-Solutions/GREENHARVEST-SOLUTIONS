const { pool } = require("../config/db");

const listBuyerAddresses = async (userId) => {
  const res = await pool.query(
    `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, address_id DESC`,
    [userId]
  );
  return res.rows;
};

const getAddressById = async (addressId, client = pool) => {
  const res = await client.query(`SELECT * FROM addresses WHERE address_id = $1`, [addressId]);
  return res.rows[0] || null;
};

const createAddress = async ({
  user_id,
  label = "Home",
  line1,
  line2 = null,
  city,
  state = null,
  country = "Ethiopia",
  postal_code = null,
  region = null,
  zone_area = null,
  subcity = null,
  woreda = null,
  landmark = null,
  latitude = null,
  longitude = null,
  delivery_instructions = null,
  contact_name = null,
  contact_phone = null,
  verification_status = "unverified",
  is_default = false,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (is_default) {
      await client.query(`UPDATE addresses SET is_default = FALSE WHERE user_id = $1`, [user_id]);
    }
    const res = await client.query(
      `INSERT INTO addresses (
         user_id, label, line1, line2, city, state, country, postal_code,
         region, zone_area, subcity, woreda, landmark, latitude, longitude,
         delivery_instructions, contact_name, contact_phone, verification_status, is_default, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW()
       ) RETURNING *`,
      [
        user_id, label, line1, line2, city, state || region, country, postal_code,
        region, zone_area, subcity, woreda, landmark, latitude, longitude,
        delivery_instructions, contact_name, contact_phone, verification_status, Boolean(is_default),
      ]
    );
    await client.query("COMMIT");
    return res.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const updateAddress = async (addressId, userId, fields) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (fields.is_default) {
      await client.query(`UPDATE addresses SET is_default = FALSE WHERE user_id = $1`, [userId]);
    }
    const res = await client.query(
      `UPDATE addresses
       SET label = COALESCE($1, label),
           line1 = COALESCE($2, line1),
           line2 = COALESCE($3, line2),
           city = COALESCE($4, city),
           state = COALESCE($5, state),
           region = COALESCE($6, region),
           zone_area = COALESCE($7, zone_area),
           subcity = COALESCE($8, subcity),
           woreda = COALESCE($9, woreda),
           landmark = COALESCE($10, landmark),
           latitude = COALESCE($11, latitude),
           longitude = COALESCE($12, longitude),
           delivery_instructions = COALESCE($13, delivery_instructions),
           contact_name = COALESCE($14, contact_name),
           contact_phone = COALESCE($15, contact_phone),
           verification_status = COALESCE($16, verification_status),
           is_default = COALESCE($17, is_default),
           updated_at = NOW()
       WHERE address_id = $18 AND user_id = $19
       RETURNING *`,
      [
        fields.label ?? null,
        fields.line1 ?? null,
        fields.line2 ?? null,
        fields.city ?? null,
        fields.state ?? null,
        fields.region ?? null,
        fields.zone_area ?? null,
        fields.subcity ?? null,
        fields.woreda ?? null,
        fields.landmark ?? null,
        fields.latitude !== undefined ? fields.latitude : null,
        fields.longitude !== undefined ? fields.longitude : null,
        fields.delivery_instructions ?? null,
        fields.contact_name ?? null,
        fields.contact_phone ?? null,
        fields.verification_status ?? null,
        fields.is_default ?? null,
        addressId,
        userId,
      ]
    );
    await client.query("COMMIT");
    return res.rows[0] || null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const deleteAddress = async (addressId, userId) => {
  const res = await pool.query(
    `DELETE FROM addresses WHERE address_id = $1 AND user_id = $2 RETURNING address_id`,
    [addressId, userId]
  );
  return res.rows[0] || null;
};

module.exports = {
  createAddress,
  deleteAddress,
  getAddressById,
  listBuyerAddresses,
  updateAddress,
};
