const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

let testAdmin;
let testAdminAuthToken;

let testFranchise;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
    // create regular test user
    testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
    const registerRes = await request(app).post("/api/auth").send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);

    // create test admin
    testAdmin = await createAdminUser();
    const loginAdminRes = await request(app).put("/api/auth").send(testAdmin);
    testAdminAuthToken = loginAdminRes.body.token;
    testAdmin.id = loginAdminRes.body.user.id;
    expectValidJwt(testAdminAuthToken);

    // create test franchise
    testFranchise = { name: randomName(), admins: [testAdmin] };
    const createRes = await request(app).post("/api/franchise").set("Authorization", `Bearer ${testAdminAuthToken}`).send(testFranchise);
    testFranchise.id = createRes.body.id;
    expect(createRes.status).toBe(200);
    expect(createRes.body.name).toEqual(testFranchise.name);
    expect(createRes.body.admins[0].email).toEqual(testAdmin.email);
});

test("get franchises", async () => {
    const adminReq = { "user": testAdmin};
    const res = await request(app).get("/api/franchise").send(adminReq);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
});

test("get user franchises", async () => {
    const res = await request(app).get(`/api/franchise/${testAdmin.id}`).set("Authorization", `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
});

test("non admin create franchise", async () => {
    const res = await request(app).post("/api/franchise").set("Authorization", `Bearer ${testUserAuthToken}`).send(testFranchise);
    expect(res.status).toBe(403);
    expect(res.body.message).toEqual("unable to create a franchise" );
});

test ("non admin delete franchise", async () => {
    const res = await request(app).delete(`/api/franchise/${testFranchise.id}`).set("Authorization", `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toEqual("unable to delete a franchise");
});

test("create and delete store", async () => {
    const store = { name: randomName() };
    const createStoreRes = await request(app).post(`/api/franchise/${testFranchise.id}/store`).set("Authorization", `Bearer ${testAdminAuthToken}`).send(store);
    expect(createStoreRes.status).toBe(200);
    expect(createStoreRes.body.name).toEqual(store.name);

    // bad delete store non admin
    const badDeleteStoreRes = await request(app).delete(`/api/franchise/${testFranchise.id}/store/${createStoreRes.body.id}`).set("Authorization", `Bearer ${testUserAuthToken}`);
    expect(badDeleteStoreRes.status).toBe(403);
    expect(badDeleteStoreRes.body.message).toEqual("unable to delete a store");

    // successful delete store
    const deleteStoreRes = await request(app).delete(`/api/franchise/${testFranchise.id}/store/${createStoreRes.body.id}`).set("Authorization", `Bearer ${testAdminAuthToken}`);
    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.body).toEqual({ message: "store deleted" });
});

test("bad create store non admin", async () => {
    const store = { name: randomName() };
    const createStoreRes = await request(app).post(`/api/franchise/${testFranchise.id}/store`).set("Authorization", `Bearer ${testUserAuthToken}`).send(store);
    expect(createStoreRes.status).toBe(403);
    expect(createStoreRes.body.message).toEqual("unable to create a store");
});

afterAll(async () => {
  // delete test franchise
  const deleteRes = await request(app).delete(`/api/franchise/${testFranchise.id}`).set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body).toEqual({ message: "franchise deleted" });
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}