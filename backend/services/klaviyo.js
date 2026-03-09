const db = require('../database');

function getKlaviyoSettings() {
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = ?").get('klaviyo_api_key');
  const listId = db.prepare("SELECT value FROM settings WHERE key = ?").get('klaviyo_list_id');
  return {
    apiKey: apiKey?.value || '',
    listId: listId?.value || '',
  };
}

async function addToKlaviyo(email) {
  const { apiKey, listId } = getKlaviyoSettings();

  if (!apiKey || !listId) {
    return { success: false, error: 'Klaviyo not configured' };
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
  };

  try {
    // Step 1: Create or update the profile
    const profileRes = await fetch('https://a.klaviyo.com/api/profiles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: { email },
        },
      }),
    });

    let profileId;
    if (profileRes.status === 201) {
      const created = await profileRes.json();
      profileId = created.data.id;
    } else if (profileRes.status === 409) {
      // Profile already exists — get the ID from the duplicate error
      const errData = await profileRes.json();
      profileId = errData.errors?.[0]?.meta?.duplicate_profile_id;
    }

    if (!profileId) {
      return { success: false, error: 'Failed to create/find profile' };
    }

    // Step 2: Add the profile to the list
    const listRes = await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: [{ type: 'profile', id: profileId }],
      }),
    });

    if (listRes.ok || listRes.status === 204) {
      return { success: true };
    }

    const errorData = await listRes.json().catch(() => ({}));
    return { success: false, error: errorData?.errors?.[0]?.detail || `Klaviyo list add error (${listRes.status})` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { addToKlaviyo, getKlaviyoSettings };
