const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test("logout", async () => {
    const logoutRes = await request(app).delete("/api/auth").set("Authorization", `Bearer ${testUserAuthToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ message: "logout successful" });
});

test("bad auth token", async () => {
  const logoutRes = await request(app).delete("/api/auth").set("Authorization", `Bearer bad-token`);
  expect(logoutRes.status).toBe(401);
  expect(logoutRes.body).toEqual({ message: "unauthorized" });
});

test("bad register", async () => {
    const badUser = { name: "pizza diner", password: "a" };
    const registerRes = await request(app).post("/api/auth").send(badUser);
    expect(registerRes.status).toBe(400);
    expect(registerRes.body).toEqual({ message: "name, email, and password are required" });
});

test("update user", async () => {
    const updateUser = { email: randomName() + "@test.com", password: "b" };
    let adminUser = await createAdminUser();
    const loginAdminRes = await request(app).put("/api/auth").send(adminUser);
    expect(loginAdminRes.status).toBe(200);
    expectValidJwt(loginAdminRes.body.token);
    const adminAuthToken = loginAdminRes.body.token;
    adminUser = loginAdminRes.body.user;
    const updateUserRes = await request(app).put(`/api/auth/${adminUser.id}`).set("Authorization", `Bearer ${adminAuthToken}`).send(updateUser);
    expect(updateUserRes.status).toBe(200);
    expect(updateUserRes.body.email).toEqual(updateUser.email);
    expect(updateUserRes.body.id).toEqual(adminUser.id);
});

test("update user not admin", async () => {
    const updateUser = { email: randomName() + "@test.com", password: "b" };
    const nonAdminUser = { name: "pizza diner", email: randomName() + "@test.com", password: "a" };
    const registerRes = await request(app).post("/api/auth").send(nonAdminUser);
    const nonAdminUserAuthToken = registerRes.body.token;
    expectValidJwt(nonAdminUserAuthToken);
    const updateUserRes = await request(app).put("/api/auth/100").set("Authorization", `Bearer ${nonAdminUserAuthToken}`).send(updateUser);
    expect(updateUserRes.status).toBe(403);
    expect(updateUserRes.body).toEqual({ message: "unauthorized" });
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
