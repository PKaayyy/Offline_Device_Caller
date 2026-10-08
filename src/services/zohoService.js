const axios = require("axios");
const { getAccessToken, zohoHeaders } = require("./zohoAuth");

// Base API configuration loaded from environmental variables
const ZOHO_PROJECTS_API =
  process.env.ZOHO_PROJECTS_API || "https://projectsapi.zoho.in";
const ZOHO_PORTAL_ID = process.env.ZOHO_PORTAL_ID;
const ZOHO_PROJECT_NAME =
  process.env.ZOHO_PROJECT_NAME || "pr-34 DATA MAPPING";

/**
 * Standardizes text values by trimming spaces and converting to lowercase for comparison.
 */
function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Robust numerical converter that handles empty strings or strings containing letters safely.
 */
function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * REGEX HTML PARSER: Scrapes tabular support values from the HTML description of a Zoho task.
 * Zoho Projects encodes description layouts as HTML tables containing key-value rows:
 * e.g., <tr><td><b>Customer Name</b></td> <td>Vindhya</td></tr>
 * 
 * @param {string} html - Raw description HTML string
 * @param {string} label - The search parameter label to extract (e.g. "Customer Name")
 */
function extractFromDescription(html, label) {
  if (!html) return "";
  // Search for the label in bold, skip the table boundary elements, and extract text inside the adjacent table column cell
  const regex = new RegExp(`<b>${label}</b></td>\\s*<td>(.*?)</td>`, "i");
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Converts a raw Zoho Task object into our structured MongoDB customer details representation.
 * @param {object} task - Zoho Task JSON payload
 * @param {string} parentTaskId - Optional parent task ID linking
 */
function mapTaskToCustomer(task, parentTaskId) {
  const description = task.description || "";

  return {
    zohoSubtaskId: String(task.id),
    zohoTaskPrefix: task.prefix || "",
    zohoParentTaskId: String(parentTaskId || ""),

    // Scrapes customer fields from the HTML description, falling back to task name if name table cell is blank
    cxName: extractFromDescription(description, "Customer Name") || task.name || "",
    cxId: extractFromDescription(description, "Customer ID"),
    cxNumber: extractFromDescription(description, "Customer Number"),
    totalUnits: toNumber(extractFromDescription(description, "Total Devices")),
    offlineUnits: toNumber(extractFromDescription(description, "Offline Devices")),
    updatedExpiry: extractFromDescription(description, "Updated Expiry"),

    rawZohoData: task, // Keeps a backup of the original Zoho payload for diagnostics
  };
}

/**
 * Generic pagination utility. Zoho API only returns up to 200 items per page.
 * This helper calls 'fetchPage' repeatedly (incrementing page index) until a page 
 * returns fewer items than the limit, indicating we have reached the last page.
 */
async function fetchAllPages(fetchPage) {
  const allItems = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { items } = await fetchPage(page);
    allItems.push(...items);

    if (items.length < perPage) break; // Exit loop if page is partially filled (indicates last page)
    page += 1;
  }

  return allItems;
}

/**
 * Pulls all projects available in the Zoho Projects portal.
 */
async function listProjects(accessToken) {
  const url = `${ZOHO_PROJECTS_API}/api/v3/portal/${ZOHO_PORTAL_ID}/projects`;

  return fetchAllPages(async (page) => {
    const response = await axios.get(url, {
      headers: zohoHeaders(accessToken),
      params: { page, per_page: 200 },
    });

    const data = response.data;
    const items = Array.isArray(data) ? data : data.projects || [];
    const pageInfo = Array.isArray(data) ? null : data.page_info;

    return { items, pageInfo };
  });
}

/**
 * Searches the project list to find the project matching ZOHO_PROJECT_NAME.
 */
async function findProjectByName(accessToken, projectName) {
  const projects = await listProjects(accessToken);
  const target = normalizeText(projectName);

  const project = projects.find((item) => {
    const name = normalizeText(item.name);
    return name === target || name.includes(target);
  });

  if (!project) {
    throw new Error(`Zoho project not found: "${projectName}"`);
  }

  return project;
}

/**
 * Fetches all tasks associated with a specific project ID.
 */
async function listProjectTasks(accessToken, projectId) {
  const url = `${ZOHO_PROJECTS_API}/api/v3/portal/${ZOHO_PORTAL_ID}/projects/${projectId}/tasks`;

  return fetchAllPages(async (page) => {
    const response = await axios.get(url, {
      headers: zohoHeaders(accessToken),
      params: { page, per_page: 200 },
    });

    return {
      items: response.data.tasks || [],
      pageInfo: response.data.page_info,
    };
  });
}

/**
 * MAIN ENTRY PATH FOR SYNCING:
 * 1. Exchanges credentials for a valid Zoho OAuth token.
 * 2. Finds the target project ID by name.
 * 3. Downloads all tasks under that project.
 * 4. Filters out tasks that aren't open offline follow-up records.
 * 5. Maps the remaining tasks into customer details format and returns them.
 */
async function fetchOfflineDeviceCustomers() {
  const accessToken = await getAccessToken();
  const project = await findProjectByName(accessToken, ZOHO_PROJECT_NAME);
  const tasks = await listProjectTasks(accessToken, project.id);

  // Filter tasks to match our criteria
  const customerTasks = tasks.filter((task) => {
    const isFollowUpTask = normalizeText(task.name).startsWith("offline device follow-up");
    const isOpenStatus = normalizeText(task.status?.name) === "open";
    return isFollowUpTask && isOpenStatus;
  });

  // Convert Zoho task array into MongoDB customer model data structure
  const customers = customerTasks.map((task) =>
    mapTaskToCustomer(task, null)
  );

  return {
    project: { id: project.id, name: project.name },
    parentTask: { id: null, name: "N/A (flat task list)", prefix: null },
    customers,
  };
}

module.exports = {
  fetchOfflineDeviceCustomers,
  mapTaskToCustomer,
};
