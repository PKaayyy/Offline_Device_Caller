require("dotenv").config();
const axios = require("axios");
const { getAccessToken, zohoHeaders } = require("../src/services/zohoAuth");

async function main() {
  const accessToken = await getAccessToken();
  const projectsApi = process.env.ZOHO_PROJECTS_API || "https://projectsapi.zoho.in";
  const portalId = process.env.ZOHO_PORTAL_ID;
  const projectId = "313488000001590003";

  const url = `${projectsApi}/api/v3/portal/${portalId}/projects/${projectId}/tasks`;
  const response = await axios.get(url, {
    headers: zohoHeaders(accessToken),
    params: { page: 1, per_page: 5 },
  });

  const tasks = response.data.tasks || [];
  const sample = tasks.find((t) => t.name.startsWith("Offline Device Follow-up"));

  console.log(JSON.stringify(sample, null, 2));
}

main().catch((err) => console.error("Failed:", err.response?.data || err.message));
