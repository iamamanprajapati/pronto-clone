// Use global fetch
const API = 'http://localhost:4000';

async function test() {
  console.log('Logging in...');
  const loginRes = await fetch(`${API}/v1/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@pronto.local', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Logged in successfully, token acquired.');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // 1. Get initial cities
  console.log('\n--- Fetching initial cities/zones ---');
  const getRes1 = await fetch(`${API}/v1/admin/cities`, { headers });
  const data1 = await getRes1.json();
  const firstZone = data1.cities[0].zones[0];
  console.log(`First Zone: ${firstZone.name} (id: ${firstZone.id}), active: ${firstZone.active}`);

  // 2. Toggle active status via PATCH
  const nextActive = !firstZone.active;
  console.log(`\nToggling zone active status to: ${nextActive}...`);
  const patchRes = await fetch(`${API}/v1/admin/zones/${firstZone.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active: nextActive }),
  });
  const patchData = await patchRes.json();
  console.log('PATCH response:', patchData);

  // 3. Fetch cities again immediately
  console.log('\nFetching cities/zones again immediately...');
  const getRes2 = await fetch(`${API}/v1/admin/cities`, { headers });
  const data2 = await getRes2.json();
  console.log('All zones in first city after update:');
  console.log(data2.cities[0].zones.map((z: any) => ({ name: z.name, id: z.id, active: z.active })));
  const updatedZone = data2.cities[0].zones.find((z: any) => z.id === firstZone.id);
  console.log(`Updated Zone: ${updatedZone.name}, active: ${updatedZone.active}`);

  // 4. Restore original status
  console.log(`\nRestoring original active status to: ${firstZone.active}...`);
  await fetch(`${API}/v1/admin/zones/${firstZone.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active: firstZone.active }),
  });
  console.log('Restored.');
}

test().catch(console.error);
