import { getIdToken, prepareTestUsers } from "./lib/cognito";
import { runApiCheck, type ApiCheck } from "./lib/api";
import { adminTestUser, regularTestUser } from "./lib/testUsers";
import { getApiBaseUrl } from "./lib/ssm";

async function main() {
  const apiBaseUrl = await getApiBaseUrl();
  const cognitoConfig = await prepareTestUsers();

  console.log("Getting tokens...");
  const [userToken, adminToken] = await Promise.all([
    getIdToken(cognitoConfig, regularTestUser),
    getIdToken(cognitoConfig, adminTestUser),
  ]);
  console.log("");

  const checks: ApiCheck[] = [
    {
      name: "public health allows anonymous access",
      path: "/public/health",
      expectedStatus: 200,
    },
    {
      name: "public gallery allows anonymous access",
      path: "/public/gallery-photos",
      expectedStatus: 200,
    },
    {
      name: "photo upload URL rejects anonymous access",
      method: "POST",
      path: "/auth/photos/presigned-url",
      expectedStatus: 401,
    },
    {
      name: "photo upload URL validates regular user request body",
      method: "POST",
      path: "/auth/photos/presigned-url",
      token: userToken,
      expectedStatus: 400,
    },
    {
      name: "profile rejects anonymous access",
      path: "/auth/users/me",
      expectedStatus: 401,
    },
    {
      name: "profile allows regular user",
      path: "/auth/users/me",
      token: userToken,
      expectedStatus: 200,
    },
    {
      name: "admin member rejects anonymous access",
      path: "/auth/admin/member",
      expectedStatus: 401,
    },
    {
      name: "admin member rejects regular user",
      path: "/auth/admin/member",
      token: userToken,
      expectedStatus: 403,
    },
    {
      name: "admin member allows administrator",
      path: "/auth/admin/member",
      token: adminToken,
      expectedStatus: 200,
    },
    {
      name: "admin delete rejects regular user",
      method: "DELETE",
      path: "/auth/admin/photos",
      token: userToken,
      expectedStatus: 403,
    },
  ];

  console.log(`Running API security checks at ${apiBaseUrl}`);
  console.log("");

  const results = [];
  for (const check of checks) {
    const result = await runApiCheck(apiBaseUrl, check);
    results.push(result);

    const status = result.passed ? "PASS" : "FAIL";
    console.log(
      `${status} ${result.name} (expected ${result.expectedStatus}, got ${result.actualStatus})`,
    );
  }

  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    console.log("");
    throw new Error(`${failures.length} API security check(s) failed.`);
  }

  console.log("");
  console.log("All API security checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
