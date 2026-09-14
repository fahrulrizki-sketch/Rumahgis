const ENDPOINT = 'https://api.buffer.com';

function required(value, label) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} belum tersedia.`);
  return result;
}

export function bufferClient({ token, fetchImpl = fetch } = {}) {
  const accessToken = required(token, 'BUFFER_ACCESS_TOKEN');

  async function request(query, variables = {}) {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Buffer API gagal dengan HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(`Buffer API gagal: ${payload.errors[0].message}`);
    return payload.data;
  }

  return {
    async accountAndChannels() {
      const data = await request(`query RumahGISBufferHealthcheck {
        account { id organizations { id name } }
      }`);
      const organizations = data?.account?.organizations || [];
      const channels = [];
      for (const organization of organizations) {
        const result = await request(`query RumahGISBufferChannels($organizationId: OrganizationId!) {
          channels(input: { organizationId: $organizationId }) { id name service }
        }`, { organizationId: organization.id });
        channels.push(...(result?.channels || []).map((channel) => ({ ...channel, organizationId: organization.id })));
      }
      return { organizations, channels };
    },
  };
}
