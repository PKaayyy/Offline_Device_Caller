const axios = require("axios");
const { getAccessToken, zohoHeaders } = require("./zohoAuth");

const ZOHO_PROJECTS_API =
  process.env.ZOHO_PROJECTS_API || "https://projectsapi.zoho.in";
const ZOHO_PORTAL_ID = process.env.ZOHO_PORTAL_ID;
const ZOHO_PROJECT_NAME =
  process.env.ZOHO_PROJECT_NAME || "pr-34 DATA MAPPING";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function pickField(task, fieldName) {
  if (!fieldName) return undefined;
  if (Object.prototype.hasOwnProperty.call(task, fieldName)) {
    return task[fieldName];
  }
  return undefined;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractFromDescription(html, label) {
  if (!html) return "";
  const regex = new RegExp(`<b>${label}</b></td>\\s*<td>(.*?)</td>`, "i");
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

function mapTaskToCustomer(task, parentTaskId) {
  const description = task.description || "";

  return {
    zohoSubtaskId: String(task.id),
    zohoTaskPrefix: task.prefix || "",
    zohoParentTaskId: String(parentTaskId || ""),
    cxName: extractFromDescription(description, "Customer Name") || task.name || "",
    cxId: extractFromDescription(description, "Customer ID"),
    cxNumber: extractFromDescription(description, "Customer Number"),
    totalUnits: toNumber(extractFromDescription(description, "Total Devices")),
    offlineUnits: toNumber(extractFromDescription(description, "Offline Devices")),
    updatedExpiry: extractFromDescription(description, "Updated Expiry"),
    rawZohoData: task,
  };
}

async function fetchAllPages(fetchPage) {
  const allItems = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { items } = await fetchPage(page);
    allItems.push(...items);

    if (items.length < perPage) break; // last page reached
    page += 1;
  }

  return allItems;
}

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

function findParentTask(tasks, parentTaskName) {
  const target = normalizeText(parentTaskName);

  const parentTask = tasks.find((task) => {
    const name = normalizeText(task.name);
    return name === target || name.includes(target);
  });

  if (!parentTask) {
    throw new Error(`Parent task not found: "${parentTaskName}"`);
  }

  return parentTask;
}

function findSubtasks(tasks, parentTaskId) {
  const parentId = String(parentTaskId);

  const byParentId = tasks.filter((task) => {
    const parentFromInfo = task.parental_info?.parent_task_id;
    return parentFromInfo && String(parentFromInfo) === parentId;
  });

  if (byParentId.length > 0) {
    return byParentId;
  }

  // Some portals expose subtasks via association flags on the parent task only.
  // If nothing matched, return an empty list so the API response is explicit.
  return [];
}

/**
 * Main read path:
 * project -> parent task -> subtasks -> mapped customer rows
 */
async function fetchOfflineDeviceCustomers() {
  const accessToken = await getAccessToken();
  const project = await findProjectByName(accessToken, ZOHO_PROJECT_NAME);
  const tasks = await listProjectTasks(accessToken, project.id);

  const customerTasks = tasks.filter((task) => {
    const isFollowUpTask = normalizeText(task.name).startsWith("offline device follow-up");
    const isOpenStatus = normalizeText(task.status?.name) === "open";
    return isFollowUpTask && isOpenStatus;
  });

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
