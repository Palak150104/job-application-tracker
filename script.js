"use strict";

// -------------------- Configuration --------------------

const STORAGE_KEY = "careertrack_applications_v1";

const STATUSES = [
    "Applied",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn"
];

// -------------------- HTML Elements --------------------

const jobForm = document.getElementById("jobForm");

const companyInput = document.getElementById("company");
const roleInput = document.getElementById("role");
const locationInput = document.getElementById("location");
const jobTypeInput = document.getElementById("jobType");
const statusInput = document.getElementById("status");
const appliedDateInput = document.getElementById("appliedDate");
const deadlineInput = document.getElementById("deadline");
const jobUrlInput = document.getElementById("jobUrl");
const notesInput = document.getElementById("notes");

const applicationList = document.getElementById("applicationList");
const emptyState = document.getElementById("emptyState");

const totalCount = document.getElementById("totalCount");
const appliedCount = document.getElementById("appliedCount");
const interviewCount = document.getElementById("interviewCount");
const offerCount = document.getElementById("offerCount");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortFilter = document.getElementById("sortFilter");
const visibleCount = document.getElementById("visibleCount");

const formHeading = document.getElementById("formHeading");
const submitButton = document.getElementById("submitButton");
const cancelButton = document.getElementById("cancelButton");
const formMessage = document.getElementById("formMessage");

const deleteDialog = document.getElementById("deleteDialog");
const keepButton = document.getElementById("keepButton");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");

// -------------------- Application State --------------------

let applications = loadApplications();
let editingId = null;
let pendingDeleteId = null;

// -------------------- Utility Functions --------------------

function getLocalDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day;
}

function formatDate(value) {
    if (!isValidDate(value)) {
        return "—";
    }

    const [year, month, day] = value.split("-").map(Number);

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date(year, month - 1, day));
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character];
    });
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("error", isError);
}

function countStatus(status) {
    return applications.filter(function (application) {
        return application.status === status;
    }).length;
}

// -------------------- Storage --------------------

function loadApplications() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(function (application) {
            return application
                && typeof application.id === "string"
                && typeof application.company === "string"
                && application.company.trim() !== ""
                && typeof application.role === "string"
                && application.role.trim() !== ""
                && STATUSES.includes(application.status)
                && typeof application.appliedDate === "string"
                && isValidDate(application.appliedDate);
        });
    } catch (error) {
        console.error("Could not load saved applications:", error);
        return [];
    }
}

function saveApplications() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
        return true;
    } catch (error) {
        console.error("Could not save applications:", error);
        showMessage(
            "Unable to save data. Check your browser storage.",
            true
        );
        return false;
    }
}

// -------------------- Form Handling --------------------

function readForm() {
    const company = companyInput.value.trim();
    const role = roleInput.value.trim();
    const location = locationInput.value.trim();
    const jobType = jobTypeInput.value;
    const status = statusInput.value;
    const appliedDate = appliedDateInput.value;
    const deadline = deadlineInput.value;
    const jobUrl = jobUrlInput.value.trim();
    const notes = notesInput.value.trim();

    if (!company || !role) {
        showMessage("Company and job title are required.", true);
        return null;
    }

    if (!STATUSES.includes(status)) {
        showMessage("Choose a valid application status.", true);
        return null;
    }

    if (!isValidDate(appliedDate)) {
        showMessage("Please select a valid application date.", true);
        return null;
    }

    if (deadline && !isValidDate(deadline)) {
        showMessage("Please select a valid follow-up date.", true);
        return null;
    }

    if (jobUrl) {
        try {
            const url = new URL(jobUrl);

            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error("Unsupported URL protocol");
            }
        } catch {
            showMessage("Enter a valid HTTP or HTTPS job URL.", true);
            return null;
        }
    }

    return {
        company,
        role,
        location,
        jobType,
        status,
        appliedDate,
        deadline,
        jobUrl,
        notes
    };
}

function resetForm() {
    editingId = null;

    jobForm.reset();
    appliedDateInput.value = getLocalDate();
    jobTypeInput.value = "Full-time";
    statusInput.value = "Applied";

    formHeading.textContent = "Add a job application";
    submitButton.textContent = "Save application";
    cancelButton.classList.add("hidden");

    showMessage("");
}

jobForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const formData = readForm();

    if (!formData) {
        return;
    }

    if (editingId !== null) {
        const index = applications.findIndex(function (application) {
            return application.id === editingId;
        });

        if (index === -1) {
            showMessage("Application not found. Try again.", true);
            resetForm();
            return;
        }

        const previous = applications[index];

        applications[index] = {
            ...previous,
            ...formData,
            updatedAt: new Date().toISOString()
        };

        if (!saveApplications()) {
            applications[index] = previous;
            return;
        }

        resetForm();
        renderApp();
        showMessage("Application updated successfully.");
        return;
    }

    const application = {
        id: createId(),
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    applications.unshift(application);

    if (!saveApplications()) {
        applications.shift();
        return;
    }

    resetForm();
    renderApp();
    showMessage("Application added successfully.");
});

cancelButton.addEventListener("click", resetForm);

// -------------------- Edit Applications --------------------

function editApplication(id) {
    const application = applications.find(function (item) {
        return item.id === id;
    });

    if (!application) {
        return;
    }

    editingId = id;

    companyInput.value = application.company;
    roleInput.value = application.role;
    locationInput.value = application.location || "";
    jobTypeInput.value = application.jobType || "Full-time";
    statusInput.value = application.status;
    appliedDateInput.value = application.appliedDate;
    deadlineInput.value = application.deadline || "";
    jobUrlInput.value = application.jobUrl || "";
    notesInput.value = application.notes || "";

    formHeading.textContent = "Edit job application";
    submitButton.textContent = "Save changes";
    cancelButton.classList.remove("hidden");

    showMessage("Editing application.");

    document.getElementById("applicationForm").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    companyInput.focus({ preventScroll: true });
}

// -------------------- Delete Applications --------------------

function requestDelete(id) {
    if (!applications.some(function (application) {
        return application.id === id;
    })) {
        return;
    }

    pendingDeleteId = id;

    if (typeof deleteDialog.showModal === "function") {
        deleteDialog.showModal();
    } else if (window.confirm("Delete this application?")) {
        deleteApplication(id);
    }
}

function deleteApplication(id) {
    const index = applications.findIndex(function (application) {
        return application.id === id;
    });

    if (index === -1) {
        return;
    }

    const removed = applications.splice(index, 1)[0];

    if (!saveApplications()) {
        applications.splice(index, 0, removed);
        renderApp();
        return;
    }

    if (editingId === id) {
        resetForm();
    }

    renderApp();
    showMessage("Application deleted.");
}

confirmDeleteButton.addEventListener("click", function () {
    if (pendingDeleteId !== null) {
        deleteApplication(pendingDeleteId);
    }

    pendingDeleteId = null;
    deleteDialog.close();
});

keepButton.addEventListener("click", function () {
    pendingDeleteId = null;
    deleteDialog.close();
});

deleteDialog.addEventListener("close", function () {
    pendingDeleteId = null;
});

// -------------------- Dashboard Statistics --------------------

function renderStats() {
    totalCount.textContent = applications.length;
    appliedCount.textContent = countStatus("Applied");
    interviewCount.textContent = countStatus("Interview");
    offerCount.textContent = countStatus("Offer");
}

// -------------------- Search, Filter, and Sort --------------------

function getVisibleApplications() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const sortMode = sortFilter.value;

    const filtered = applications.filter(function (application) {
        const searchableText = [
            application.company,
            application.role,
            application.location,
            application.notes
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(query);

        const matchesStatus = selectedStatus === "All"
            || application.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    if (sortMode === "newest") {
        filtered.sort((a, b) =>
            b.appliedDate.localeCompare(a.appliedDate)
            || b.createdAt.localeCompare(a.createdAt)
        );
    } else if (sortMode === "oldest") {
        filtered.sort((a, b) =>
            a.appliedDate.localeCompare(b.appliedDate)
            || a.createdAt.localeCompare(b.createdAt)
        );
    } else if (sortMode === "company") {
        filtered.sort((a, b) =>
            a.company.localeCompare(b.company)
        );
    } else if (sortMode === "upcoming") {
        filtered.sort(function (a, b) {
            const aDate = a.deadline || "9999-12-31";
            const bDate = b.deadline || "9999-12-31";

            return aDate.localeCompare(bDate);
        });
    }

    return filtered;
}

// -------------------- Render Applications --------------------

function renderApplications() {
    const visibleApplications = getVisibleApplications();

    applicationList.replaceChildren();

    visibleApplications.forEach(function (application) {
        const row = document.createElement("tr");

        const companyCell = document.createElement("td");
        const companyWrapper = document.createElement("div");
        companyWrapper.className = "company-cell";

        const logo = document.createElement("span");
        logo.className = "company-logo";
        logo.textContent = application.company.charAt(0).toUpperCase();

        const info = document.createElement("div");
        info.className = "company-info";

        const companyName = document.createElement("strong");
        companyName.textContent = application.company;

        const roleName = document.createElement("span");
        roleName.textContent = application.role;

        info.append(companyName, roleName);
        companyWrapper.append(logo, info);
        companyCell.appendChild(companyWrapper);

        const locationCell = document.createElement("td");
        locationCell.textContent = application.location || "—";

        const appliedCell = document.createElement("td");
        appliedCell.textContent = formatDate(application.appliedDate);

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = `status-badge status-${application.status.toLowerCase()}`;
        badge.textContent = application.status;
        statusCell.appendChild(badge);

        const deadlineCell = document.createElement("td");

        if (application.deadline) {
            deadlineCell.textContent = formatDate(application.deadline);
        } else {
            deadlineCell.textContent = "—";
        }

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "action-button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function () {
            editApplication(application.id);
        });

        actions.appendChild(editButton);

        if (application.jobUrl) {
            const link = document.createElement("a");
            link.className = "action-button job-link";
            link.href = application.jobUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Job";
            link.setAttribute("aria-label", `Open job posting for ${application.company}`);

            actions.appendChild(link);
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "action-button delete";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
            requestDelete(application.id);
        });

        actions.appendChild(deleteButton);
        actionsCell.appendChild(actions);

        row.append(
            companyCell,
            locationCell,
            appliedCell,
            statusCell,
            deadlineCell,
            actionsCell
        );

        applicationList.appendChild(row);
    });

    emptyState.classList.toggle("hidden", visibleApplications.length > 0);

    visibleCount.textContent = `${visibleApplications.length} ${
        visibleApplications.length === 1 ? "application" : "applications"
    }`;
}

// -------------------- Render Everything --------------------

function renderApp() {
    renderStats();
    renderApplications();
}

// -------------------- Filter Events --------------------

searchInput.addEventListener("input", renderApplications);
statusFilter.addEventListener("change", renderApplications);
sortFilter.addEventListener("change", renderApplications);

// -------------------- Initialize --------------------

document.getElementById("todayLabel").textContent =
    new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date());

appliedDateInput.value = getLocalDate();

renderApp();