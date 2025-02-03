const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const pizza1 = {
  description: "A garden of delight",
  id: 1,
  image: "pizza1.png",
  price: 0.0038,
  title: "Veggie",
};

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

let testAdmin;
let testAdminAuthToken;
let order1;
let order2;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
  // create regular test user
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
  expectValidJwt(testUserAuthToken);

  // create test admin
  testAdmin = await createAdminUser();
  const loginAdminRes = await request(app).put("/api/auth").send(testAdmin);
  testAdminAuthToken = loginAdminRes.body.token;
  testAdmin.id = loginAdminRes.body.user.id;
  expectValidJwt(testAdminAuthToken);

  // add test menu item
  let newMenuItem = {
    description: "No topping, no sauce, just carbs",
    image: "pizza9.png",
    price: 0.0001,
    title: "TestItem",
  };
  const addItemRes = await request(app).put("/api/order/menu").set("Authorization", `Bearer ${testAdminAuthToken}`).send(newMenuItem);
  expect(addItemRes.status).toBe(200);

  // create orders
    order1 = {
        dinerId: testUser.id,
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: "TestItem", price: 0.0001 }],
    };
    order2 = {
        dinerId: testUser.id,
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: "TestItem", price: 0.0001 }],
    };
    const orderRes1 = await request(app).post("/api/order").set("Authorization", `Bearer ${testUserAuthToken}`).send(order1);
    const orderRes2 = await request(app).post("/api/order").set("Authorization", `Bearer ${testUserAuthToken}`).send(order2);
    expect(orderRes1.status).toBe(200);
    expect(orderRes2.status).toBe(200);
    order1 = orderRes1.body.order;
    order2 = orderRes2.body.order;
});

test("get menu", async () => {
    const res = await request(app).get("/api/order/menu");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body).toContainEqual(pizza1);
});

test("add menu item", async () => {
    let newMenuItem = {
        description: "No topping, no sauce, just carbs",
        image: "pizza9.png",
        price: 0.0001,
        title: "TestItem",
    };
    const addItemRes = await request(app).put("/api/order/menu").set("Authorization", `Bearer ${testAdminAuthToken}`).send(newMenuItem);
    expect(addItemRes.status).toBe(200);
    newMenuItem = addItemRes.body.find((item) => item.title === "Student");
    expect(addItemRes.body).toContainEqual(newMenuItem);
});

test("bad add menu item as diner", async () => {
    let newMenuItem = {
        description: "No topping, no sauce, just carbs",
        image: "pizza9.png",
        price: 0.0001,
        title: "Student",
    };
    const addItemRes = await request(app).put("/api/order/menu").set("Authorization", `Bearer ${testUserAuthToken}`).send(newMenuItem);
    expect(addItemRes.status).toBe(403);
    expect(addItemRes.body.message).toEqual("unable to add menu item");
});

test("get orders", async () => {
    const res = await request(app).get("/api/order").set("Authorization", `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.dinerId).toBe(testUser.id);
    expect(res.body.orders.length).toEqual(2);
    expect(res.body.orders[0].items[0].description).toEqual(order1.items[0].description);
    expect(res.body.orders[1].items[0].description).toEqual(order2.items[0].description);
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