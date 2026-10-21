frappe.pages["asr-report"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Account Service Request",
		single_column: true,
	});

	// ── State ────────────────────────────────────────────────────────────────
	const state = {
		filters:  {},
		offset:   0,
		pageSize: 20,
		total:    0,
		loading:  false,
		done:     false,
		mainTab:   "all",   // all | pending | completed
		subStatus: "",      // "" or one of Open/In-Progress/Closed/Resolved
		summary:   {},      // global status counts (ignores status filter)
		colSearch: {},      // per-column text search {key: text}
	};

	// Taskflow-style groups: Pending = Open+In-Progress, Completed = Closed+Resolved.
	const TAB_GROUPS = {
		pending:   ["Open", "In-Progress"],
		completed: ["Closed", "Resolved"],
	};

	// Pending-tab sub-badges: the two response_pending values (Open removed
	// per request). Completed tab keeps its status sub-badges.
	const SUB_BADGES = {
		pending:   ["Pending Operations", "Pending Branch"],
		completed: ["Closed", "Resolved"],
	};
	// Sub values that filter on response_pending instead of status.
	const RP_SUBS = ["Pending Operations", "Pending Branch"];

	// ── Status colors ────────────────────────────────────────────────────────
	const STATUS_STYLE = {
		"Open":        "background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;",
		"In-Progress": "background:#fef3c7;color:#b45309;border:1px solid #fcd34d;",
		"Resolved":    "background:#dcfce7;color:#15803d;border:1px solid #86efac;",
		"Closed":      "background:#d1fae5;color:#047857;border:1px solid #6ee7b7;",
	};
	const RP_STYLE = {
		"Pending Operations": "background:#f3e8ff;color:#7e22ce;border:1px solid #d8b4fe;",
		"Pending Branch":     "background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;",
		"Resolved":           "background:#dcfce7;color:#15803d;border:1px solid #86efac;",
	};

	function badge(text, styleStr) {
		if (!text) return "—";
		return `<span style="display:inline-flex;align-items:center;padding:2px 10px;
			border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;
			${styleStr || "background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;"}"
		>${frappe.utils.escape_html(text)}</span>`;
	}

	// ── Format Last Modified ─────────────────────────────────────────────────
	function formatModified(modifiedStr) {
		if (!modifiedStr) return { html: "—", isRecent: false };

		let dt;
		try {
			dt = new Date(modifiedStr.replace(" ", "T"));
		} catch(e) {
			return { html: modifiedStr, isRecent: false };
		}
		if (!dt || isNaN(dt.getTime())) return { html: modifiedStr || "—", isRecent: false };

		const now     = new Date();
		const diffMs  = now - dt;
		const diffMins = diffMs / 60000;

		if (diffMins >= 0 && diffMins < 2) {
			return {
				html: `<span style="display:inline-flex;align-items:center;padding:2px 10px;
					border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;
					background:#dcfce7;color:#15803d;border:1px solid #86efac;">Just Now</span>`,
				isRecent: true,
			};
		}

		const d    = String(dt.getDate()).padStart(2, "0");
		const mo   = String(dt.getMonth() + 1).padStart(2, "0");
		const y    = dt.getFullYear();
		let h      = dt.getHours();
		const mi   = String(dt.getMinutes()).padStart(2, "0");
		const ampm = h >= 12 ? "PM" : "AM";
		h = h % 12 || 12;
		const hh   = String(h).padStart(2, "0");

		return {
			html: `<div style="white-space:nowrap;color:#475569;">${d}-${mo}-${y}</div>
				<div style="font-size:10.5px;color:#94a3b8;white-space:nowrap;">${hh}:${mi} ${ampm}</div>`,
			isRecent: false,
		};
	}

	// ── Page toolbar buttons ─────────────────────────────────────────────────
	page.add_button(__("Refresh"), () => resetAndLoad(), { icon: "refresh" });
	page.set_primary_action(__("Export CSV"), () => exportCSV(), "download");

	// ── Filter bar HTML ──────────────────────────────────────────────────────
	const $filterBar = $(`
		<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;
			padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;
			border:1px solid #e2e8f0;border-top:none;">

		<div style="display:flex;flex-direction:column;gap:3px;">
			<label style="font-size:11px;font-weight:600;color:#64748b;">Status</label>
			<select id="asr-filter-status" style="height:32px;border:1px solid #cbd5e1;
				border-radius:6px;padding:0 8px;font-size:12px;min-width:130px;background:#fff;">
				<option value="">All</option>
				<option value="Open">Open</option>
				<option value="In-Progress">In-Progress</option>
				<option value="Resolved">Resolved</option>
				<option value="Closed">Closed</option>
			</select>
		</div>

			<div style="display:flex;flex-direction:column;gap:3px;">
				<label style="font-size:11px;font-weight:600;color:#64748b;">Response Pending</label>
				<select id="asr-filter-rp" style="height:32px;border:1px solid #cbd5e1;
					border-radius:6px;padding:0 8px;font-size:12px;min-width:160px;background:#fff;">
					<option value="">All</option>
					<option value="Pending Operations">Pending Operations</option>
					<option value="Pending Branch">Pending Branch</option>
					<option value="Resolved">Resolved</option>
				</select>
			</div>

			<div style="display:flex;flex-direction:column;gap:3px;">
				<label style="font-size:11px;font-weight:600;color:#64748b;">Request Type</label>
				<select id="asr-filter-rt" style="height:32px;border:1px solid #cbd5e1;
					border-radius:6px;padding:0 8px;font-size:12px;min-width:200px;background:#fff;">
					<option value="">All</option>
				</select>
			</div>

			<div style="display:flex;flex-direction:column;gap:3px;">
				<label style="font-size:11px;font-weight:600;color:#64748b;">SOL ID</label>
				<select id="asr-filter-sol" style="height:32px;border:1px solid #cbd5e1;
					border-radius:6px;padding:0 8px;font-size:12px;min-width:140px;background:#fff;">
					<option value="">All</option>
				</select>
			</div>

			<div style="display:flex;flex-direction:column;gap:3px;">
				<label style="font-size:11px;font-weight:600;color:#64748b;">From Date</label>
				<input type="date" id="asr-filter-from"
					style="height:32px;border:1px solid #cbd5e1;border-radius:6px;
					padding:0 8px;font-size:12px;min-width:130px;background:#fff;" />
			</div>

			<div style="display:flex;flex-direction:column;gap:3px;">
				<label style="font-size:11px;font-weight:600;color:#64748b;">To Date</label>
				<input type="date" id="asr-filter-to"
					style="height:32px;border:1px solid #cbd5e1;border-radius:6px;
					padding:0 8px;font-size:12px;min-width:130px;background:#fff;" />
			</div>

			<div style="display:flex;align-items:flex-end;gap:6px;margin-top:auto;">
				<button id="asr-clear-btn" title="Clear Filters"
					style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;
					background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;
					border-radius:6px;font-size:16px;cursor:pointer;padding:0;">
					↺
				</button>
			</div>
		</div>
	`).appendTo(page.main);

	// ── Page layout: main = flex column, exact viewport height ─────────────
	// NOTE: page.main KHUD .layout-main-section hai (direct ref). Purani
	// $(wrapper).closest(...) lines silent no-op thi (section wrapper ka
	// descendant hai, ancestor nahi) — isliye height/chain kabhi lagi hi nahi.
	$("body").css("overflow", "hidden");
	const $main = $(page.main);
	$main.css({
		display: "flex",
		"flex-direction": "column",
		"min-width": "0",
		"max-width": "100%",
		overflow: "hidden",
	});

	// ── Table wrapper ────────────────────────────────────────────────────────
	const $tableWrap = $(`
		<div id="asr-table-wrap" style="flex:1 1 auto;min-height:0;min-width:0;width:100%;overflow:auto;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;background:#fff;">
			<table id="asr-table" style="border-collapse:collapse;font-size:12.5px;width:2010px;min-width:2010px;table-layout:fixed;">
				<thead style="position:sticky;top:0;z-index:3;">
					<tr style="background:#f8fafc;border-bottom:2px solid rgba(65,124,125,0.2);">
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:50px;">S.No</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:88px;position:sticky;left:0;z-index:5;background:#f8fafc;border-right:1px solid #e2e8f0;box-shadow:2px 0 4px rgba(0,0,0,0.06);">Comments</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:110px;">Ticket</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:100px;">Creation Date</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:160px;">Request Type</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:80px;">SOL ID</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:120px;">Branch</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:100px;">Status</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:160px;">Response Pending</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:50px;">Cycle</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:130px;">Employee</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:90px;">State</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:90px;">Zone</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:90px;">Region</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:90px;">District</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:110px;">Resolved By</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:120px;">Resolved Date</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:160px;">Remark</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:130px;position:sticky;right:0;z-index:5;background:#f8fafc;border-left:1px solid #e2e8f0;box-shadow:-2px 0 4px rgba(0,0,0,0.06);">Last Modified</th>
					</tr>
					<tr id="asr-filter-row" style="background:#fff;border-bottom:2px solid rgba(65,124,125,0.2);"></tr>
				</thead>
				<tbody id="asr-tbody"></tbody>
			</table>
			<div id="asr-loading" style="padding:40px;text-align:center;color:#94a3b8;font-size:13px;">Loading...</div>
			<div id="asr-empty" style="display:none;padding:40px;text-align:center;color:#94a3b8;font-size:13px;">No records found.</div>
			<div id="asr-scroll-sentinel" style="height:1px;"></div>
		</div>
	`).appendTo(page.main);

	// ── Fit main to remaining viewport height (settled layout + resize) ────
	// Wrap flex:1 se bachi jagah lega — na katagea, na khaali chhodega.
	// Bars squeeze na hon: flex none.
	$filterBar.css("flex", "0 0 auto");
	$("#asr-tabs-row").css("flex", "0 0 auto");
	const fitPage = () => {
		const mainEl = $main && $main[0];
		if (!mainEl) return;
		const top = mainEl.getBoundingClientRect().top || 0;
		$main.css("height", Math.max(300, window.innerHeight - top - 12) + "px");
	};
	requestAnimationFrame(() => {
		fitPage();
		setTimeout(fitPage, 300);
	});
	$(window).off("resize.asr").on("resize.asr", fitPage);

	// ── Load filter options ──────────────────────────────────────────────────
	frappe.call({
		method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_filter_options",
		callback(r) {
			const opts = r.message || {};
			const $rt = $("#asr-filter-rt");
			(opts.request_types || []).forEach(rt => {
				$rt.append(`<option value="${rt}">${rt}</option>`);
			});
			const $sol = $("#asr-filter-sol");
			(opts.sol_ids || []).forEach(s => {
				$sol.append(`<option value="${s.sol_id}">${s.sol_id}${s.branch ? " – " + s.branch : ""}</option>`);
			});
		},
	});

	// ── Taskflow-style status tabs row (extra row; Status dropdown as-is) ────
	// Left: All | Pending | Completed. Right (same row): sub-status badges.
	const MAIN_TABS = [
		{ key: "all",       label: "All" },
		{ key: "pending",   label: "Pending" },
		{ key: "completed", label: "Completed" },
	];
	$(`
		<div id="asr-tabs-row" style="display:flex;align-items:center;gap:8px;width:100%;
			padding:8px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;">
			<div id="asr-main-tabs" style="display:inline-flex;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:2px;gap:2px;"></div>
			<div id="asr-sub-tabs" style="display:inline-flex;gap:6px;margin-left:auto;flex-wrap:wrap;"></div>
		</div>
	`).insertBefore($filterBar);
	function tabCounts() {
		const s = state.summary || {};
		return {
			all:       s.Total || 0,
			pending:   (s.Open || 0) + (s["In-Progress"] || 0),
			completed: (s.Closed || 0) + (s.Resolved || 0),
		};
	}
	function renderTabs() {
		const counts = tabCounts();
		const $main = $("#asr-main-tabs");
		$main.empty();
		MAIN_TABS.forEach(t => {
			const active = state.mainTab === t.key;
			$main.append(`
				<button data-tab="${t.key}" style="border:none;cursor:pointer;
					padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;
					${active ? "background:#417c7d;color:#fff;" : "background:transparent;color:#475569;"}">
					${t.label} (${counts[t.key]})
				</button>`);
		});
		$main.find("button").on("click", function () {
			state.mainTab = $(this).data("tab");
			state.subStatus = "";
			$("#asr-filter-status").val("");
			renderTabs();
			applyFilters();
		});
		const $sub = $("#asr-sub-tabs");
		$sub.empty();
	// Light tints per sub-status; active = teal border.
	const SUB_STYLE = {
		"Open":               { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
		"In-Progress":        { bg: "#fef3c7", color: "#b45309", border: "#fcd34d" },
		"Closed":             { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
		"Resolved":           { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
		"Pending Operations": { bg: "#f3e8ff", color: "#7e22ce", border: "#d8b4fe" },
		"Pending Branch":     { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
	};
		(SUB_BADGES[state.mainTab] || []).forEach(s => {
			const active = state.subStatus === s;
			const cnt = (state.summary || {})[s] || 0;
			const st = SUB_STYLE[s] || SUB_STYLE["Closed"];
			$sub.append(`
				<button data-sub="${s}" style="cursor:pointer;
					padding:3px 12px;border-radius:999px;font-size:11.5px;font-weight:600;
					background:${st.bg};color:${st.color};
					border:1px solid ${active ? "#417c7d" : st.border};">
					${s} (${cnt})
				</button>`);
		});
		$sub.find("button").on("click", function () {
			const s = $(this).data("sub");
			state.subStatus = (state.subStatus === s) ? "" : s;
			$("#asr-filter-status").val("");
			renderTabs();
			applyFilters();
		});
	}
	renderTabs();

	// ── Event bindings ───────────────────────────────────────────────────────
	function statusList() {
		if (state.subStatus && !RP_SUBS.includes(state.subStatus)) return [state.subStatus];
		return TAB_GROUPS[state.mainTab] || [];
	}
	function applyFilters() {
	 // Tabs win when set; else fall back to the Status dropdown (as-is).
		let statuses = statusList();
		if (!statuses.length) {
			const s = $("#asr-filter-status").val();
			if (s) statuses = [s];
		}
		// RP sub-badges filter on response_pending (within pending statuses).
		const rpSub = RP_SUBS.includes(state.subStatus) ? state.subStatus : "";
		state.filters = {
			statuses:         statuses,
			response_pending: rpSub || $("#asr-filter-rp").val(),
			request_type:     $("#asr-filter-rt").val(),
			sol_id:           $("#asr-filter-sol").val(),
			from_date:        $("#asr-filter-from").val(),
			to_date:          $("#asr-filter-to").val(),
			column_search:    state.colSearch || {},
		};
		resetAndLoad();
	}

	$("#asr-filter-status").on("change", () => {
		state.mainTab = "all";
		state.subStatus = "";
		renderTabs();
		applyFilters();
	});
	// ── Per-column search (only where needed; server filters) ──────────────
	// Order = thead order (empty cell keeps alignment).
	const COL_SEARCH_COLS = [
		{ key: null, label: "" },
		{ key: "ticket", label: "Ticket" },
		{ key: "creation_date", label: "Creation Date" },
		{ key: "request_type", label: "Request Type" },
		{ key: "sol_id", label: "SOL ID" },
		{ key: "branch", label: "Branch" },
		{ key: null, label: "" },
		{ key: null, label: "" },
		{ key: null, label: "" },
		{ key: "employee", label: "Employee" },
		{ key: "state", label: "State" },
		{ key: "zone", label: "Zone" },
		{ key: "region", label: "Region" },
		{ key: "district", label: "District" },
		{ key: "resolved_by", label: "Resolved By" },
		{ key: "resolved_date", label: "Resolved Date" },
		{ key: null, label: "" },
		{ key: null, label: "" },
	];
	(function buildColumnFilters() {
		const $row = $("#asr-filter-row");
		if (!$row.length) return;
		$row.append(`<td style="padding:4px 6px;background:#f8fafc;"></td>`);
		COL_SEARCH_COLS.forEach((c, i) => {
			const first = i === 0, last = i === COL_SEARCH_COLS.length - 1;
			const sticky = first
				? "position:sticky;left:0;z-index:5;border-right:1px solid #e2e8f0;box-shadow:2px 0 4px rgba(0,0,0,0.06);"
				: last
					? "position:sticky;right:0;z-index:5;border-left:1px solid #e2e8f0;box-shadow:-2px 0 4px rgba(0,0,0,0.06);"
					: "";
			if (!c.key) {
				$row.append(`<td style="padding:4px 6px;background:#f8fafc;${sticky}"></td>`);
				return;
			}
			$row.append(`
				<td style="padding:4px 6px;background:#f8fafc;${sticky}">
					<div style="position:relative;">
						<span style="position:absolute;left:6px;top:50%;transform:translateY(-50%);
							color:#94a3b8;display:flex;pointer-events:none;">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
								stroke="currentColor" stroke-width="2" stroke-linecap="round">
								<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
							</svg>
						</span>
						<input class="asr-col-search" data-col="${c.key}" placeholder="${c.label}"
							style="width:100%;height:26px;border:1px solid #e2e8f0;border-radius:5px;
							padding:0 6px 0 24px;font-size:11px;color:#1e293b;background:#f8fafc;outline:none;" />
					</div>
				</td>`);
		});
	})();
	let colTimer = null;
	$("#asr-table-wrap").on("input", ".asr-col-search", function () {
		clearTimeout(colTimer);
		colTimer = setTimeout(() => {
			const q = {};
			$(".asr-col-search").each(function () {
				const v = ($(this).val() || "").trim();
				if (v) q[$(this).data("col")] = v;
			});
			state.colSearch = q;
			applyFilters();
		}, 400);
	});
	$("#asr-table-wrap").on("focus", ".asr-col-search", function () {
		$(this).css({ "border-color": "#417c7d", background: "#fff" });
	});
	$("#asr-table-wrap").on("blur", ".asr-col-search", function () {
		$(this).css({ "border-color": "#e2e8f0", background: "#f8fafc" });
	});
	$("#asr-filter-rp, #asr-filter-rt, #asr-filter-sol").on("change", applyFilters);
	$("#asr-filter-from, #asr-filter-to").on("change", applyFilters);

	$("#asr-clear-btn").on("click", () => {
		$("#asr-filter-status,#asr-filter-rp,#asr-filter-rt,#asr-filter-sol").val("");
		$("#asr-filter-from,#asr-filter-to").val("");
		$(".asr-col-search").val("");
		state.colSearch = {};
		state.mainTab = "all";
		state.subStatus = "";
		renderTabs();
		state.filters = {};
		resetAndLoad();
	});

	// ── Infinite scroll via IntersectionObserver ─────────────────────────────
	const sentinel = document.getElementById("asr-scroll-sentinel");
	const scrollRoot = document.getElementById("asr-table-wrap");
	const observer = new IntersectionObserver((entries) => {
		if (entries[0].isIntersecting && !state.loading && !state.done) {
			loadMore();
		}
	}, { root: scrollRoot, threshold: 0.1 });
	observer.observe(sentinel);

	// ── Reset and load from scratch ──────────────────────────────────────────
	function resetAndLoad() {
		state.offset = 0;
		state.done   = false;
		state.byTicket = {};
		$("#asr-tbody").empty();
		$("#asr-empty").hide();
		loadMore();
	}

	// ── Load next batch ──────────────────────────────────────────────────────
	function loadMore() {
		if (state.loading || state.done) return;
		state.loading = true;
		$("#asr-loading").show();

		frappe.call({
			method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_report_data",
			args: {
				filters:   state.filters,
				page_no:   Math.floor(state.offset / state.pageSize) + 1,
				page_size: state.pageSize,
			},
			callback(r) {
				state.loading = false;
				$("#asr-loading").hide();
				const res  = r.message || {};
				const rows = res.data || [];
				state.total = res.total || 0;
				state.summary = res.summary || {};
				renderTabs();

				if (rows.length === 0 && state.offset === 0) {
					$("#asr-empty").show();
				}

				appendRows(rows);
				state.offset += rows.length;

				if (state.offset >= state.total || rows.length < state.pageSize) {
					state.done = true;
				}
			},
			error() {
				state.loading = false;
				$("#asr-loading").hide();
				frappe.msgprint(__("Failed to load report data."));
			},
		});
	}

	// ── Shared workflow actions (row popup + dialog, same rules as form) ────
	function wfActionsFor(row) {
		const out = [];
		row = row || {};
		if ((row.dept_name || "") !== "Operations") return out;
		const st = row.status || "";
		const rp = row.response_pending || "";
		const cpc = frappe.user.has_role("Operations Support Executive") || frappe.user.has_role("CPC Loan User");
		const br = frappe.user.has_role("Employee") || frappe.user.has_role("Branch User");
		if (cpc && (st === "Open" || st === "In-Progress") && rp !== "Pending Branch") {
			out.push({ key: "Send to Branch", rp: "Pending Branch",
				field: "executive_remark", commentAfter: true,
				title: "Enter Remark for Branch", label: "Branch Remark" });
		}
		if (br && st === "In-Progress" && rp !== "Pending Operations") {
			out.push({ key: "Send to CPC", rp: "Pending Operations",
				field: "executive_remark", commentAfter: true,
				title: "Enter Info Provided", label: "Info for CPC" });
		}
		if ((cpc && (st === "Open" || st === "In-Progress")) || (br && st === "In-Progress")) {
			out.push({ key: "Mark Resolved",
				field: "resolved_remark", stampResolve: true, forceField: true,
				title: "Enter Resolve Remark", label: "Resolve Remark" });
		}
		return out;
	}

	function runWfAction(ticket, a, preset, afterOk) {
		if (!a) return;
		// preset = chat text (dialog sends): resolve saves it into
		// resolved_remark; sends fill an empty executive_remark only
		// (already posted, never re-post). No preset -> remark prompt.
		// Prompt stays ONLY for Mark Resolved without chat text.
		// Use set_value instead of get+save to avoid document-modified conflict.
		// set_value patches only the specified fields without a full doc round-trip.
		const runWithRemark = (remark, toComment, setField) => {
			const updates = {};
			if (setField) updates[a.field] = remark;
			if (a.rp)     updates.response_pending = a.rp;
			if (a.stampResolve) {
				updates.ticket_resolved_by = frappe.session.user;
				updates.ticket_resolved_on = frappe.datetime.now_datetime();
			}

			const applyWf = () => frappe.call({
				method: "frappe.model.workflow.apply_workflow",
				args: { doc: { doctype: "Sahayog Ticket", name: ticket }, action: a.key },
				callback: () => { frappe.msgprint(__("{0} done.", [a.key])); afterOk && afterOk(); },
				error:    () => frappe.msgprint(__("Action failed. Please open the ticket and try from the form.")),
			});

			const postCommentThenWf = () => {
				if (toComment) {
					frappe.call({
						method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.add_ticket_comment",
						args: { ticket: ticket, text: remark },
						callback: applyWf,
						error: () => frappe.msgprint(__("Could not save remark.")),
					});
				} else {
					applyWf();
				}
			};

			if (Object.keys(updates).length) {
				frappe.call({
					method: "frappe.client.set_value",
					args: { doctype: "Sahayog Ticket", name: ticket, fieldname: updates },
					callback: postCommentThenWf,
					error: () => frappe.msgprint(__("Could not update ticket.")),
				});
			} else {
				postCommentThenWf();
			}
		};

		// For row popup (preset===undefined) we need the current field value to
		// decide comment-vs-field. For dialog path we skip the extra get call.
		if (preset === undefined) {
			frappe.call({
				method: "frappe.client.get_value",
				args: { doctype: "Sahayog Ticket", fieldname: a.field, filters: { name: ticket } },
				callback(r2) {
					const existing = ((r2 && r2.message) || {})[a.field] || "";
					const toComment = !a.forceField && !!existing;
					frappe.prompt(
						{ label: a.label, fieldname: "remark", fieldtype: "Small Text", reqd: 1 },
						(vals) => {
							const remark = (((vals || {}).remark) || "").trim();
							if (!remark) return;
							runWithRemark(remark, toComment, !toComment);
						},
						__(a.title + (toComment ? " (Comment)" : "")), __("Submit")
					);
				},
				error: () => frappe.msgprint(__("You do not have access to update this ticket. Please open it from the list.")),
			});
			return;
		}
		// Dialog path: preset = last chat text (may be "").
		if (preset) {
			runWithRemark(preset, false, a.forceField);
			return;
		}
		if (a.key !== "Mark Resolved") {
			frappe.msgprint(__("Type your message in chat first, then choose the action."));
			return;
		}
		frappe.prompt(
			{ label: a.label, fieldname: "remark", fieldtype: "Small Text", reqd: 1 },
			(vals) => {
				const remark = (((vals || {}).remark) || "").trim();
				if (!remark) return;
				runWithRemark(remark, false, true);
			},
			__(a.title), __("Submit")
		);
	}

	// Small floating popup (like the old send-icon menu).
	function openWfPopup(ticket, actions, x, y) {
		$(".asr-wf-float").remove();
		if (!actions.length) return;
		const $p = $(`
			<div class="asr-wf-float" style="position:fixed;z-index:2000;background:#fff;
				border:1px solid #e2e8f0;border-radius:10px;
				box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:200px;">
				<div style="font-size:10px;color:#94a3b8;font-weight:700;
					letter-spacing:.05em;padding:4px 8px 6px;">WORKFLOW</div>
				${actions.map((a, i) => `
				<button data-idx="${i}" style="display:flex;width:100%;
					text-align:left;gap:8px;align-items:center;background:#fff;
					cursor:pointer;border:none;border-radius:7px;
					padding:7px 8px;font-size:12.5px;font-weight:600;color:#0f172a;">
					<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;
						background:#e6f2f2;color:#1f5c5d;
						display:flex;align-items:center;justify-content:center;">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
							stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="22" y1="2" x2="11" y2="13"/>
							<polygon points="22 2 15 22 11 13 2 9 22 2"/>
						</svg>
					</span>
					${a.key}
				</button>`).join("")}
			</div>`);
		const w = 220, h = 60 + actions.length * 44;
		$p.css({ left: Math.max(8, Math.min(x, window.innerWidth - w)) + "px",
			top: Math.max(8, Math.min(y, window.innerHeight - h)) + "px" });
		$p.find("[data-idx]").on("click", function () {
			const a = actions[+$(this).data("idx")];
			$p.remove();
			runWfAction(ticket, a, () => resetAndLoad());
		});
		$(document).one("click", () => $p.remove());
		$("body").append($p);
	}

	// ── Append rows ──────────────────────────────────────────────────────────
	function appendRows(rows) {
		state.byTicket = state.byTicket || {};
		rows.forEach(rr => { state.byTicket[rr.ticket] = rr; });
		const $tbody  = $("#asr-tbody");
		const baseIdx = $tbody.children().length;
		const tdBase  = `padding:9px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
		const tdGray  = `style="${tdBase}color:#475569;"`;
		const tdPlain = `style="${tdBase}"`;

		rows.forEach((r, idx) => {
			const rowIdx = baseIdx + idx;
			const bg     = rowIdx % 2 === 0 ? "#fff" : "#fafafa";
			const mod    = formatModified(r.modified);

			const $tr = $(`<tr style="cursor:pointer;border-bottom:1px solid #f1f5f9;background:${bg};transition:background 0.1s ease;">
				<td style="${tdBase}color:#94a3b8;">${rowIdx + 1}</td>
				<td class="asr-cmt-cell" style="${tdBase}position:sticky;left:0;z-index:2;background:${bg};border-right:1px solid #e2e8f0;box-shadow:2px 0 4px rgba(0,0,0,0.06);cursor:default;" title="${frappe.utils.escape_html((r.last_comment_by ? r.last_comment_by + ': ' : '') + (r.last_comment || ''))}">
					${r.comments_count
						? `<span class="asr-cmt-count" style="display:inline-block;min-width:20px;text-align:center;font-weight:700;font-size:11px;color:#1f5c5d;background:#e6f2f2;border:1px solid #417c7d;border-radius:999px;padding:0 6px;margin-right:4px;cursor:default;">${r.comments_count}</span><button class="btn btn-xs btn-default asr-cmt-btn" data-ticket="${frappe.utils.escape_html(r.ticket)}" title="View comments" style="padding:1px 6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>`
						: `<button class="btn btn-xs btn-default asr-cmt-btn" data-ticket="${frappe.utils.escape_html(r.ticket)}" title="Add comment" style="padding:1px 6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>`}
				</td>
				<td style="${tdBase}font-weight:600;color:#417c7d;" title="${frappe.utils.escape_html(r.ticket)}">${frappe.utils.escape_html((r.ticket || "").split("-").slice(-2).join("-") || r.ticket)}${wfActionsFor(r).length ? ` <button class="asr-row-act" title="Workflow actions" style="border:1px solid #cbd5e1;background:#fff;cursor:pointer;border-radius:6px;padding:0 6px;margin-left:4px;font-size:11px;color:#417c7d;font-weight:700;">›</button>` : ""}</td>
				<td ${tdGray}>
					${r.creation_date ? r.creation_date.split("-").reverse().join("-") : "—"}
					<span style="display:block;font-size:10.5px;color:#94a3b8;">${(function(){
						if (!r.creation_time) return "";
						const parts = r.creation_time.slice(0,8).split(":");
						let h = parseInt(parts[0]);
						const mi = parts[1];
						const ampm = h >= 12 ? "PM" : "AM";
						h = h % 12 || 12;
						return String(h).padStart(2,"0") + ":" + mi + " " + ampm;
					})()}</span>
				</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.request_type || "—")}</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.sol_id || "—")}</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.branch || "—")}</td>
				<td style="${tdBase}">${badge(r.status, STATUS_STYLE[r.status])}</td>
				<td style="${tdBase}">${r.response_pending ? badge(r.response_pending, RP_STYLE[r.response_pending]) : "—"}</td>
				<td style="${tdBase}text-align:center;color:#64748b;">${r.ticket_cycle || 0}</td>
				<td ${tdGray}>
					<span style="font-weight:500;display:block;overflow:hidden;text-overflow:ellipsis;">${frappe.utils.escape_html(r.employee_name || "—")}</span>
					<span style="font-size:10.5px;color:#94a3b8;display:block;overflow:hidden;text-overflow:ellipsis;">${frappe.utils.escape_html(r.employee_id || "")}</span>
				</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.state || "—")}</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.zone || "—")}</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.region || "—")}</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.district || "—")}</td>
				<td ${tdGray}>${frappe.utils.escape_html(r.resolved_by || "—")}</td>
				<td style="padding:9px 12px;overflow:hidden;">
					${(function() {
						if (!r.resolved_date) return "—";
						const d = r.resolved_date.split("-").reverse().join("-");
						if (!r.resolved_time) return d;
						const parts = r.resolved_time.slice(0,5).split(":");
						let h = parseInt(parts[0]);
						const mi = parts[1];
						const ampm = h >= 12 ? "PM" : "AM";
						h = h % 12 || 12;
						return `<div style="white-space:nowrap;color:#475569;">${d}</div><div style="font-size:10.5px;color:#94a3b8;white-space:nowrap;">${String(h).padStart(2,"0")}:${mi} ${ampm}</div>`;
					})()}
				</td>
				<td style="${tdBase}font-size:11.5px;color:#475569;">${frappe.utils.escape_html(r.remark || "—")}</td>
				<td style="padding:9px 12px;overflow:hidden;border-left:1px solid #e2e8f0;position:sticky;right:0;z-index:2;background:${bg};box-shadow:-2px 0 4px rgba(0,0,0,0.06);">
					${mod.html}
				</td>
			</tr>`);

			$tr.on("mouseenter", function () {
				$(this).css("background", "#f0f9f9");
				$(this).find("td[style*='position:sticky']").css("background", "#f0f9f9");
			});
			$tr.on("mouseleave", function () {
				$(this).css("background", bg);
				$(this).find("td[style*='position:sticky']").css("background", bg);
			});
			$tr.on("click", () => frappe.set_route("Form", "Sahayog Ticket", r.ticket));
			// Count pill: dead (no form, no popup).
			$tr.find(".asr-cmt-count").on("click", function (e) {
				e.stopPropagation();
			});
			$tr.find(".asr-cmt-btn").on("click", function (e) {
				e.stopPropagation();
				showComments($(this).data("ticket"), r);
			});
			// Row action trigger: small popup (like old send-icon menu).
			$tr.find(".asr-row-act").on("click", function (e) {
				e.stopPropagation();
				openWfPopup(r.ticket, wfActionsFor(r), e.clientX, e.clientY);
			});
			// Comments cell: anywhere click = dialog only, never the form.
			$tr.find(".asr-cmt-cell").on("click", function (e) {
				if ($(e.target).closest(".asr-cmt-btn").length) return;
				e.stopPropagation();
				showComments(r.ticket, r);
			});

			$tbody.append($tr);
		});
	}

	// ── All-comments popup ───────────────────────────────────────────────────
	// "2026-10-14 15:37:51" -> "14-10-26 03:37 PM".
	function fmtCmtDt(s) {
		if (!s) return "";
		const parts = String(s).split(" ");
		if (parts.length < 2) return s;
		const d = parts[0].split("-");
		if (d.length !== 3) return s;
		const t = parts[1].slice(0, 5).split(":");
		let h = parseInt(t[0], 10);
		const mi = t[1] || "00";
		const ampm = h >= 12 ? "PM" : "AM";
		h = h % 12 || 12;
		return `${d[2]}-${d[1]}-${d[0].slice(2)} ${String(h).padStart(2, "0")}:${mi} ${ampm}`;
	}
	function showComments(ticket, row) {
		row = row || {};
		// Same visibility as the form (shared helper). Recomputed on
		// fresh doc below (table row may be stale).
		const wfActions = [];
		const computeActions = () => {
			wfActions.length = 0;
			wfActions.push(...wfActionsFor(row));
		};
		computeActions();
		const d = new frappe.ui.Dialog({
			title: "",
			size:  "large",
			fields: [{ fieldtype: "HTML", fieldname: "chat_html", options: "" }],
		});
		d.show();
		d.$wrapper.find(".modal-footer").hide();
		d.$wrapper.find(".modal-header").css({"border-bottom":"none","padding":"10px 16px 0"});
		d.$wrapper.find(".modal-body").css("padding","0");
		// Compact modal width
		d.$wrapper.find(".modal-dialog").css({"max-width":"1180px","width":"1180px"});

		// Show loading immediately so no blank flash
		d.fields_dict.chat_html.$wrapper.html(`
			<div style="display:flex;align-items:center;justify-content:center;
				height:200px;gap:8px;color:#94a3b8;font-size:13px;">
				<div style="width:16px;height:16px;border:2px solid #e2e8f0;
					border-top-color:#417c7d;border-radius:50%;
					animation:asr-spin 0.7s linear infinite;"></div>
				Loading...
			</div>
			<style>
				@keyframes asr-spin { to { transform: rotate(360deg); } }
			</style>
		`);

		const me = frappe.session.user;

		const initial = n => (n || "?").trim().charAt(0).toUpperCase();
		const avatarColor = n => {
			const colors = ["#0f766e","#1d4ed8","#7e22ce","#b45309","#b91c1c","#047857","#0369a1"];
			let h = 0;
			for (let i = 0; i < (n||"").length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
			return colors[Math.abs(h) % colors.length];
		};

		function fmtTime(s) {
			if (!s) return "";
			const dt = new Date(s.replace(" ", "T"));
			if (isNaN(dt)) return "";
			let h = dt.getHours(), mi = String(dt.getMinutes()).padStart(2,"0");
			const ap = h >= 12 ? "PM" : "AM";
			h = h % 12 || 12;
			return `${String(h).padStart(2,"0")}:${mi} ${ap}`;
		}

		function fmtDateKey(s) {
			if (!s) return "";
			const dt = new Date(s.replace(" ", "T"));
			if (isNaN(dt)) return "";
			const today = new Date();
			const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
			const isSame = (a, b) => a.toDateString() === b.toDateString();
			if (isSame(dt, today)) return "Today";
			if (isSame(dt, yesterday)) return "Yesterday";
			const d = String(dt.getDate()).padStart(2,"0");
			const m = String(dt.getMonth()+1).padStart(2,"0");
			return `${d}/${m}/${dt.getFullYear()}`;
		}

		let activeTab = "chat";

		function renderMessages(list) {
			const $area = d.$wrapper.find("#asr-chat-messages");
			$area.empty();

			if (!list.length) {
				$area.html(`
					<div style="display:flex;flex-direction:column;align-items:center;
						justify-content:center;height:100%;gap:10px;">
						<svg width="44" height="44" viewBox="0 0 24 24" fill="none"
							stroke="#cbd5e1" stroke-width="1.2">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
						</svg>
						<span style="font-size:13px;color:#94a3b8;">No messages yet</span>
					</div>`);
				return;
			}

			let lastDateKey = "";
			list.forEach(c => {
				const dispName = c.name || (c.by || "").split("@")[0];
				const isMine  = c.by === me;
				const color   = avatarColor(dispName);
				const dateKey = fmtDateKey(c.on);
				const timeStr = fmtTime(c.on);
				const shortBy = dispName;

				// ── Date divider ──
				if (dateKey && dateKey !== lastDateKey) {
					lastDateKey = dateKey;
					$area.append(`
						<div style="display:flex;align-items:center;gap:8px;margin:10px 0 8px;">
							<div style="flex:1;height:1px;background:#e2e8f0;"></div>
							<span style="font-size:10.5px;color:#94a3b8;font-weight:500;
								background:#f8fafc;padding:1px 8px;border-radius:999px;
								border:1px solid #e2e8f0;">${frappe.utils.escape_html(dateKey)}</span>
							<div style="flex:1;height:1px;background:#e2e8f0;"></div>
						</div>`);
				}

				if (isMine) {
					// ── Sent — right, name + icon above ──
					$area.append(`
						<div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:6px;margin-bottom:4px;">
							<div style="max-width:72%;display:flex;flex-direction:column;align-items:flex-end;">
								<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
									<span style="font-size:10.5px;color:#0f766e;font-weight:600;">You</span>
									<div style="width:18px;height:18px;border-radius:50%;flex-shrink:0;background:${color};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;">${frappe.utils.escape_html(initial(dispName))}</div>
								</div>
								<div style="background:#e2f0d9;color:#1a3a1a;border-radius:12px 12px 3px 12px;padding:6px 11px;font-size:13px;line-height:1.45;text-align:left;word-break:break-word;white-space:pre-wrap;width:fit-content;max-width:100%;">${frappe.utils.escape_html(c.text)}</div>
								<span style="font-size:10px;color:#94a3b8;margin-top:2px;">${frappe.utils.escape_html(timeStr)}</span>
							</div>
						</div>`);
				} else {
					// ── Received — left, name + icon above ──
					$area.append(`
						<div style="display:flex;justify-content:flex-start;align-items:flex-end;gap:6px;margin-bottom:4px;">
							<div style="max-width:72%;display:flex;flex-direction:column;align-items:flex-start;">
								<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
									<div style="width:18px;height:18px;border-radius:50%;flex-shrink:0;background:${color};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;">${frappe.utils.escape_html(initial(dispName))}</div>
									<span style="font-size:10.5px;color:${color};font-weight:600;">${frappe.utils.escape_html(shortBy)}</span>
								</div>
								<div style="background:#f1f5f9;color:#1e293b;border-radius:12px 12px 12px 3px;padding:6px 11px;font-size:13px;line-height:1.45;text-align:left;word-break:break-word;white-space:pre-wrap;width:fit-content;max-width:100%;">${frappe.utils.escape_html(c.text)}</div>
								<span style="font-size:10px;color:#94a3b8;margin-top:2px;">${frappe.utils.escape_html(timeStr)}</span>
							</div>
						</div>`);
				}
			});

			const el = $area[0];
			el.scrollTop = el.scrollHeight;
		}

		function buildUI(list, dt) {
			dt = dt || {};
			const chatCount = list.length;

			// ── Modal title ──
			d.$wrapper.find(".modal-title").html(`
				<div style="display:flex;align-items:center;gap:8px;">
					<div style="width:32px;height:32px;border-radius:50%;
						background:linear-gradient(135deg,#417c7d,#0f766e);
						color:#fff;font-size:13px;font-weight:700;
						display:flex;align-items:center;justify-content:center;">
						${frappe.utils.escape_html(initial(ticket))}
					</div>
					<div>
						<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
							<span style="font-size:14px;font-weight:700;color:#0f172a;line-height:1.2;">
								${frappe.utils.escape_html(ticket)}
							</span>
							${badge(row.status, STATUS_STYLE[row.status]).replace("font-size:11.5px", "font-size:9px").replace("padding:2px 10px", "padding:0 6px")}
							${row.response_pending && row.response_pending !== row.status ? badge(row.response_pending, RP_STYLE[row.response_pending]).replace("font-size:11.5px", "font-size:9px").replace("padding:2px 10px", "padding:0 6px") : ""}
						</div>
						<div style="font-size:11px;color:#64748b;">Sahayog Ticket</div>
					</div>
				</div>`);

			// ── Left panel helpers ────────────────────────────────────────────────
			// Pull a single named group from row.updates[] (first item, first match).
			function _getGroup(sectionName) {
				const ups = row.updates || [];
				for (const u of ups) {
					for (const g of (u.groups || [])) {
						if (g.section === sectionName) return g;
					}
				}
				return null;
			}
			// Return value by label inside a group.
			function _groupVal(g, label) {
				if (!g) return "";
				const ln = (g.lines || []).find(l => l.label === label);
				return (ln && ln.value) ? ln.value : "";
			}
			// Build one label+value row for the details panel.
			function _detailRow(label, value, opts) {
				opts = opts || {};
				if (!value) return "";
				const escaped = frappe.utils.escape_html(value);
				const valStyle = opts.mono
					? "font-family:monospace;font-size:12.5px;color:#0f172a;font-weight:600;"
					: "font-size:12.5px;color:#1e293b;";
				const wrap = opts.wrap
					? "white-space:pre-wrap;word-break:break-word;"
					: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
				return `
					<div style="margin-bottom:7px;">
						<div style="font-size:10.5px;color:#94a3b8;font-weight:500;margin-bottom:2px;letter-spacing:.02em;">${frappe.utils.escape_html(label)}</div>
						<div style="${valStyle}${wrap}">${escaped}</div>
					</div>`;
			}

			// Gather Account Holder Details from updates (section='Account Holder Details')
			// AND CIF / attatchment from section='' group.
			const _grpRoot   = _getGroup("");
			const _grpAcct   = _getGroup("Account Holder Details");
			const _grpNew    = _getGroup("New Information");

			const cifVal      = _groupVal(_grpRoot, "Customer ID");
			const custName    = _groupVal(_grpAcct, "Customer Name");
			const acctNumber  = _groupVal(_grpAcct, "Account Number") || row.account_number;
			const acctType    = _groupVal(_grpAcct, "Account Type");
			const emailVal    = _groupVal(_grpAcct, "Email");   // account email (not new)
			const contactVal  = _groupVal(_grpAcct, "Contact Number");

			// New Information lines (only filled, any request type).
			const newLines    = (_grpNew && _grpNew.lines) ? _grpNew.lines : [];

			// Attachments from dt.files (ticket-level) — inline in Account Holder section.
			const files = (dt.files && dt.files.length) ? dt.files : [];

			d.fields_dict.chat_html.$wrapper.html(`
				<div style="display:flex;height:560px;border-radius:0 0 8px 8px;overflow:hidden;align-items:stretch;">

				<!-- LEFT: ticket details (read-only, natural scroll) -->
				<div style="width:340px;flex-shrink:0;background:#f8fafc;border-right:1px solid #e2e8f0;
					padding:0;overflow-y:auto;display:flex;flex-direction:column;">

					<!-- ── TICKET DETAILS ── -->
					<div style="padding:14px 16px 10px;">
						<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
							<span style="font-size:10.5px;font-weight:700;color:#417c7d;letter-spacing:.06em;text-transform:uppercase;">Ticket Details</span>
							<div style="flex:1;height:1px;background:#e2e8f0;"></div>
						</div>
						<div style="display:grid;grid-template-columns:1fr;gap:2px;">
							${_detailRow("Request Type", row.request_type)}
						</div>
					</div>

					<div style="height:1px;background:#e2e8f0;margin:0 16px;"></div>

					<!-- ── RAISED BY ── -->
					<div style="padding:10px 16px;">
						<div style="font-size:10.5px;font-weight:700;color:#417c7d;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Raised By</div>
						<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;">
							<div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
								<span style="font-size:12.5px;font-weight:700;color:#0f172a;">${frappe.utils.escape_html((dt.employee && dt.employee.employee_name) || row.employee_name || "—")}</span>
								<span style="font-size:11px;color:#64748b;">${frappe.utils.escape_html(row.employee_id || "")}</span>
							</div>
							${[
								["Designation", dt.employee && dt.employee.designation],
								["Department", dt.employee && dt.employee.department],
								["Branch", (dt.employee && dt.employee.branch) || row.branch],
								["Mobile", dt.employee && dt.employee.cell_number],
								["Email", (dt.employee && (dt.employee.company_email || dt.employee.personal_email))],
							].filter(([l, v]) => v).map(([l, v]) => `
								<div style="font-size:11.5px;color:#64748b;margin-top:2px;">${l}: <span style="color:#1e293b;">${frappe.utils.escape_html(v)}</span></div>`).join("")}
						</div>
					</div>

					<div style="height:1px;background:#e2e8f0;margin:0 16px;"></div>

					<!-- ── ASSIGN TO ── -->
					<div style="padding:10px 16px;">
						<div style="font-size:10.5px;font-weight:700;color:#417c7d;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Assign To</div>
						${row.assigned_to ? `
						<div id="asr-current-assign" style="display:flex;align-items:center;justify-content:space-between;
							background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:5px 10px;">
							<span style="font-size:12px;color:#15803d;font-weight:600;">
								${frappe.utils.escape_html(row.assigned_to_name || row.assigned_to)}
								<span style="font-size:10.5px;color:#64748b;font-weight:400;margin-left:4px;">(current)</span>
							</span>
							<button id="asr-unassign-btn" title="Remove assignment"
								style="border:none;background:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:0 2px;line-height:1;">✕</button>
						</div>` : `
						<div id="asr-assign-row" style="display:flex;gap:6px;">
							<div style="position:relative;flex:1;min-width:0;">
								<input id="asr-assign-search" type="text" placeholder="Search user…" autocomplete="off"
									style="width:100%;height:32px;border:1px solid #cbd5e1;border-radius:6px;padding:0 8px;font-size:12px;background:#fff;box-sizing:border-box;">
								<input type="hidden" id="asr-assign-sel" value="">
								<div id="asr-assign-list" style="display:none;position:absolute;z-index:30;top:34px;left:0;right:0;
									max-height:170px;overflow-y:auto;background:#fff;border:1px solid #cbd5e1;border-radius:6px;
									box-shadow:0 6px 16px rgba(15,23,42,.12);"></div>
							</div>
							<button id="asr-assign-btn" style="border:1px solid #417c7d;background:#417c7d;color:#fff;cursor:pointer;border-radius:6px;padding:0 12px;font-size:12px;font-weight:600;flex-shrink:0;">Assign</button>
						</div>`}
					</div>

					${dt.resolver ? `
					<div style="height:1px;background:#e2e8f0;margin:0 16px;"></div>
					<div style="padding:10px 16px 14px;">
						<div style="font-size:10.5px;font-weight:700;color:#417c7d;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Resolved By</div>
						<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 10px;">
							<div style="font-size:12.5px;font-weight:700;color:#15803d;">${frappe.utils.escape_html(dt.resolver.name || "")}</div>
							<div style="font-size:11.5px;color:#64748b;">${frappe.utils.escape_html(dt.resolver.on || "")}${dt.resolver.designation ? " · " + frappe.utils.escape_html(dt.resolver.designation) : ""}${dt.resolver.branch ? " · " + frappe.utils.escape_html(dt.resolver.branch) : ""}</div>
						</div>
					</div>` : ""}

				</div>

				<!-- MIDDLE: chat -->
				<div style="flex:1;display:flex;flex-direction:column;min-width:0;">

					<!-- Tabs -->
					<div style="display:flex;border-bottom:2px solid #e2e8f0;background:#fff;padding:0 16px;">
						<button data-tab="chat" style="padding:10px 16px;border:none;background:none;
							cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;
							align-items:center;gap:6px;border-bottom:2px solid #417c7d;
							margin-bottom:-2px;color:#417c7d;">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
								stroke="currentColor" stroke-width="2">
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
							</svg>
							Chat
						${chatCount ? `<span style="background:#417c7d;color:#fff;border-radius:999px;
							font-size:10px;font-weight:700;padding:1px 7px;">${chatCount}</span>` : ""}
					</button>
				</div>

				<!-- Pinned remarks (read-only, from record) -->
				${(row.executive_remark || (dt.resolver && dt.resolver.remark)) ? `
				<div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 16px;display:flex;flex-direction:column;gap:6px;">
					${row.executive_remark ? `
					<div style="font-size:12px;color:#1e293b;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #417c7d;border-radius:6px;padding:5px 10px;">
						<span style="font-size:10.5px;color:#417c7d;font-weight:700;">FIRST REMARK · </span>${frappe.utils.escape_html(row.executive_remark)}
					</div>` : ""}
					${(dt.resolver && dt.resolver.remark) ? `
					<div style="font-size:12px;color:#1e293b;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #16a34a;border-radius:6px;padding:5px 10px;">
						<span style="font-size:10.5px;color:#15803d;font-weight:700;">RESOLUTION · </span>${frappe.utils.escape_html(dt.resolver.remark)}
					</div>` : ""}
				</div>` : ""}

				<!-- Messages -->
				<div id="asr-chat-messages" style="flex:1;overflow-y:auto;
					padding:12px 16px;background:#fff;"></div>

					<!-- Input -->
					<div style="border-top:1px solid #e2e8f0;padding:10px 14px 8px;background:#fff;">
						<div id="asr-input-wrap" style="display:flex;align-items:flex-end;gap:6px;
							border:1.5px solid #cbd5e1;border-radius:10px;
							padding:6px 10px;background:#fff;transition:border-color 0.15s;">
							<button id="asr-attach-btn" title="Attach file"
								style="border:none;background:none;cursor:pointer;
								padding:3px;color:#94a3b8;flex-shrink:0;
								display:flex;align-items:center;">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
									stroke="currentColor" stroke-width="2"
									stroke-linecap="round" stroke-linejoin="round">
									<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49
										l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19
										a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
								</svg>
							</button>
							<textarea id="asr-msg-input" rows="1"
								placeholder="Add comment"
								style="flex:1;border:none;outline:none;resize:none;
								font-size:13px;color:#1e293b;background:transparent;
								line-height:1.5;max-height:96px;overflow-y:auto;
								padding:2px 0;font-family:inherit;"></textarea>
							<button id="asr-send-btn"
								style="border:none;background:#417c7d;cursor:pointer;
								padding:6px 9px;border-radius:7px;flex-shrink:0;
								display:flex;align-items:center;color:#fff;">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
									stroke="currentColor" stroke-width="2.5"
									stroke-linecap="round" stroke-linejoin="round">
									<line x1="22" y1="2" x2="11" y2="13"/>
									<polygon points="22 2 15 22 11 13 2 9 22 2"/>
								</svg>
							</button>
						</div>
						<div style="font-size:10.5px;color:#94a3b8;margin-top:5px;padding:0 4px;">
							Enter for a new line &nbsp;·&nbsp; Click the arrow to send
						</div>
					</div>
				</div><!-- /middle chat column -->

				<!-- RIGHT: account holder details + requested updates + attachments -->
				<div style="width:290px;flex-shrink:0;background:#f8fafc;border-left:1px solid #e2e8f0;
					padding:0;overflow-y:auto;display:flex;flex-direction:column;">

					<!-- ── ACCOUNT HOLDER DETAILS ── -->
					<div style="padding:14px 16px 10px;">
						<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
							<span style="font-size:10.5px;font-weight:700;color:#417c7d;letter-spacing:.06em;text-transform:uppercase;">Account Holder Details</span>
							<div style="flex:1;height:1px;background:#e2e8f0;"></div>
						</div>
						<div style="display:grid;grid-template-columns:1fr;gap:2px;">
							${_detailRow("Customer ID (CIF)", cifVal, { mono: true })}
							${_detailRow("Account Number", acctNumber, { mono: true })}
							${_detailRow("Customer Name", custName)}
							${_detailRow("Account Type", acctType)}
							${_detailRow("Email", emailVal)}
							${_detailRow("Contact Number", contactVal)}
						</div>
					</div>

					<!-- ── REQUESTED UPDATES ── -->
					${newLines.length ? `
					<div style="height:1px;background:#e2e8f0;margin:0 16px;"></div>
					<div style="padding:10px 16px;">
						<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
							<span style="font-size:10.5px;font-weight:700;color:#0f766e;letter-spacing:.06em;text-transform:uppercase;">Requested Updates</span>
							<div style="flex:1;height:1px;background:#e2e8f0;"></div>
						</div>
						<div style="display:flex;flex-direction:column;gap:0;">
							${newLines.map((ln) => {
								const escaped = frappe.utils.escape_html(ln.value || "");
								const isDate = /^\d{4}-\d{2}-\d{2}$/.test((ln.value || "").trim());
								const display = isDate ? ln.value.trim().split("-").reverse().join("-") : escaped;
								const isLong = (ln.value || "").length > 40;
								return `<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
									<div style="font-size:10.5px;color:#94a3b8;font-weight:500;margin-bottom:2px;">${frappe.utils.escape_html(ln.label || "")}</div>
									<div style="${isLong ? "white-space:pre-wrap;word-break:break-word;" : ""}font-size:12.5px;color:#0f172a;font-weight:600;">${isDate ? frappe.utils.escape_html(display) : escaped}</div>
								</div>`;
							}).join("")}
						</div>
					</div>` : ""}

					<!-- ── ATTACHMENTS ── -->
					${files.length ? `
					<div style="height:1px;background:#e2e8f0;margin:0 16px;"></div>
					<div style="padding:10px 16px 14px;">
						<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
							<span style="font-size:10.5px;font-weight:700;color:#417c7d;letter-spacing:.06em;text-transform:uppercase;">Attachments</span>
							<div style="flex:1;height:1px;background:#e2e8f0;"></div>
						</div>
						<div style="display:flex;flex-direction:column;gap:4px;">
							${files.map(f => {
								const fname = frappe.utils.escape_html(f.file_name || "file");
								const furl  = frappe.utils.escape_html(f.file_url || "");
								const ext   = (f.file_name || "").split(".").pop().toLowerCase();
								const isImg = ["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext);
								const isPdf = ext === "pdf";
								const icon  = isImg ? "🖼️" : isPdf ? "📄" : "📎";
								return `<div style="display:flex;align-items:center;gap:6px;
									background:#fff;border:1px solid #e2e8f0;border-radius:6px;
									padding:5px 9px;">
									<span style="font-size:13px;flex-shrink:0;">${icon}</span>
									<a href="${furl}" target="_blank" title="${fname}"
										style="flex:1;font-size:12px;color:#417c7d;text-decoration:none;
										overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
										${fname}
									</a>
									<a href="${furl}" download target="_blank" title="Download"
										style="flex-shrink:0;color:#94a3b8;text-decoration:none;
										font-size:11px;border:1px solid #e2e8f0;border-radius:4px;
										padding:1px 5px;line-height:1.6;">↓</a>
								</div>`;
							}).join("")}
						</div>
					</div>` : ""}

				</div>
				</div>
			`);

			renderMessages(list);

			// ── Auto-resize textarea ──
			const $ta = d.$wrapper.find("#asr-msg-input");
			$ta.on("input", function() {
				this.style.height = "auto";
				this.style.height = Math.min(this.scrollHeight, 96) + "px";
			});
			$ta.on("focus", () => d.$wrapper.find("#asr-input-wrap").css("border-color","#417c7d"));
			$ta.on("blur",  () => d.$wrapper.find("#asr-input-wrap").css("border-color","#cbd5e1"));

			// ── Enter = new line (send sirf arrow button se) ──
			// Send icon: sirf chat bhejo (actions upar buttons se).
			d.$wrapper.find("#asr-send-btn").off("click").on("click", sendMsg);

			// Attach: file ticket pe attach + chat me note (timeline jaisa).
			// Uploader ke upar pichhla dialog blur (dialog-over-dialog ajib lagta hai).
			d.$wrapper.find("#asr-attach-btn").on("click", function () {
				const $content = d.$wrapper.find(".modal-content");
				$content.css("filter", "blur(2px)");
				const clearBlur = () => $content.css("filter", "");
				const up = new frappe.ui.FileUploader({
					// No doctype/docname here — passing them causes Frappe to internally
					// call frappe.client.save which triggers a document-modified conflict
					// when the ticket was recently updated. We link the file manually via
					// attach_file_to_ticket after upload completes.
					on_failure: () => clearBlur(),
					on_success: (file) => {
						clearBlur();
						const furl = (file && file.file_url) || "";
						frappe.call({
							method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.attach_file_to_ticket",
							args: { ticket: ticket, file_url: furl },
							callback: () => {
								frappe.call({
									method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_ticket_comments",
									args: { ticket: ticket },
									callback(r2) {
										list = r2.message || [];
										renderMessages(list);
									},
								});
							},
						});
					},
				});
				if (up && up.dialog && up.dialog.$wrapper) {
					up.dialog.$wrapper.on("hide.bs.modal", clearBlur);
				}
			});

			// ── Action buttons left of the dialog X (compact pills) ──
			// X .modal-actions div ke andar hai (non-flex) — usko flex row
			// banao taaki buttons aur X bagal me rahein.
			d.$wrapper.find(".modal-actions").css({ display: "flex", "align-items": "center", gap: "6px" });
			d.$wrapper.find(".asr-hdr-act").remove();
			if (wfActions.length) {
				const $close = d.$wrapper.find(".modal-header .btn-modal-close");
				$close.before(`
					<div class="asr-hdr-act" style="display:flex;gap:6px;align-items:center;">
						${wfActions.map((a, i) => `
						<button data-wf-idx="${i}" style="cursor:pointer;border-radius:999px;
							padding:3px 12px;font-size:11.5px;font-weight:600;white-space:nowrap;
							${i === 0
								? "background:#417c7d;color:#fff;border:1px solid #417c7d;"
								: "background:#fff;color:#1f5c5d;border:1px solid #417c7d;"}">
							${a.key}
						</button>`).join("")}
					</div>`);
			}
			// Assign from dialog (plain field save, no workflow involved).
			d.$wrapper.find("#asr-assign-btn").on("click", function () {
				const u = d.$wrapper.find("#asr-assign-sel").val();
				if (!u) {
					frappe.msgprint(__("Select a user first."));
					return;
				}
				const uLabel = (d.$wrapper.find("#asr-assign-sel").attr("data-label") || "").trim();
				frappe.call({
					method: "frappe.client.set_value",
					args: { doctype: "Sahayog Ticket", name: ticket, fieldname: "assigned_to", value: u },
					callback: () => {
						row.assigned_to = u;
						row.assigned_to_name = uLabel;
						// Replace dropdown row with assigned card.
						d.$wrapper.find("#asr-assign-row").replaceWith(`
							<div id="asr-current-assign" style="display:flex;align-items:center;justify-content:space-between;
								background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:5px 10px;">
								<span style="font-size:12px;color:#15803d;font-weight:600;">
									${frappe.utils.escape_html(uLabel)}
									<span style="font-size:10.5px;color:#64748b;font-weight:400;margin-left:4px;">(current)</span>
								</span>
								<button id="asr-unassign-btn" title="Remove assignment"
									style="border:none;background:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:0 2px;line-height:1;">✕</button>
							</div>`);
						bindUnassign();
						resetAndLoad();
					},
					error: () => frappe.msgprint(__("Could not assign. Please open the ticket and try from the form.")),
				});
			});

			// ── Searchable assignee picker (type to filter, click/Enter to select) ──
			function bindAssignSearch() {
				const $search = d.$wrapper.find("#asr-assign-search");
				const $sel = d.$wrapper.find("#asr-assign-sel");
				const $list = d.$wrapper.find("#asr-assign-list");
				if (!$search.length) return;
				const people = (dt.assignees && dt.assignees.length) ? dt.assignees : [];

				function render(q) {
					const needle = (q || "").trim().toLowerCase();
					const items = people.filter((p) =>
						!needle ||
						String(p.label || p.value || "").toLowerCase().includes(needle) ||
						String(p.value || "").toLowerCase().includes(needle)
					);
					$list.html(items.length
						? items.map((p) => `
							<div class="asr-assign-opt"
								data-val="${frappe.utils.escape_html(p.value || "")}"
								data-label="${frappe.utils.escape_html(p.label || p.value || "")}"
								style="padding:7px 10px;font-size:12px;cursor:pointer;color:#1e293b;">
								${frappe.utils.escape_html(p.label || p.value || "")}
							</div>`).join("")
						: `<div style="padding:8px 10px;font-size:12px;color:#94a3b8;">No user found</div>`);
				}

				$search.off(".asrAssign")
					.on("focus.asrAssign input.asrAssign", function () {
						const typed = (($(this).val() || "")).trim();
						// text edited after picking → clear stale hidden selection
						if (typed !== ($sel.attr("data-label") || "").trim()) $sel.val("");
						render(typed);
						$list.show();
					})
					.on("keydown.asrAssign", function (e) {
						if (e.key === "Enter") {
							e.preventDefault();
							$list.find(".asr-assign-opt").first().trigger("mousedown");
						} else if (e.key === "Escape") {
							$list.hide();
						}
					})
					.on("blur.asrAssign", () => setTimeout(() => $list.hide(), 150));

				$list.off(".asrAssign").on("mousedown.asrAssign", ".asr-assign-opt", function (e) {
					e.preventDefault();
					const val = $(this).attr("data-val") || "";
					const label = $(this).attr("data-label") || $(this).text().trim();
					$sel.val(val).attr("data-label", label);
					$search.val(label);
					$list.hide();
				});
			}

			function bindUnassign() {
				d.$wrapper.find("#asr-unassign-btn").off("click").on("click", function () {
					frappe.call({
						method: "frappe.client.set_value",
						args: { doctype: "Sahayog Ticket", name: ticket, fieldname: "assigned_to", value: "" },
						callback: () => {
							row.assigned_to = "";
							row.assigned_to_name = "";
							// Replace card with dropdown.
							d.$wrapper.find("#asr-current-assign").replaceWith(`
								<div id="asr-assign-row" style="display:flex;gap:6px;">
									<div style="position:relative;flex:1;min-width:0;">
										<input id="asr-assign-search" type="text" placeholder="Search user…" autocomplete="off"
											style="width:100%;height:32px;border:1px solid #cbd5e1;border-radius:6px;padding:0 8px;font-size:12px;background:#fff;box-sizing:border-box;">
										<input type="hidden" id="asr-assign-sel" value="">
										<div id="asr-assign-list" style="display:none;position:absolute;z-index:30;top:34px;left:0;right:0;
											max-height:170px;overflow-y:auto;background:#fff;border:1px solid #cbd5e1;border-radius:6px;
											box-shadow:0 6px 16px rgba(15,23,42,.12);"></div>
									</div>
									<button id="asr-assign-btn" style="border:1px solid #417c7d;background:#417c7d;color:#fff;cursor:pointer;border-radius:6px;padding:0 12px;font-size:12px;font-weight:600;flex-shrink:0;">Assign</button>
								</div>`);
							bindAssignSearch();
							// Re-bind assign button on the newly injected dropdown.
							d.$wrapper.find("#asr-assign-btn").off("click").on("click", function () {
								const u2 = d.$wrapper.find("#asr-assign-sel").val();
								if (!u2) { frappe.msgprint(__("Select a user first.")); return; }
								const uLabel2 = (d.$wrapper.find("#asr-assign-sel").attr("data-label") || "").trim();
								frappe.call({
									method: "frappe.client.set_value",
									args: { doctype: "Sahayog Ticket", name: ticket, fieldname: "assigned_to", value: u2 },
									callback: () => {
										row.assigned_to = u2;
										row.assigned_to_name = uLabel2;
										d.$wrapper.find("#asr-assign-row").replaceWith(`
											<div id="asr-current-assign" style="display:flex;align-items:center;justify-content:space-between;
												background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:5px 10px;">
												<span style="font-size:12px;color:#15803d;font-weight:600;">
													${frappe.utils.escape_html(uLabel2)}
													<span style="font-size:10.5px;color:#64748b;font-weight:400;margin-left:4px;">(current)</span>
												</span>
												<button id="asr-unassign-btn" title="Remove assignment"
													style="border:none;background:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:0 2px;line-height:1;">✕</button>
											</div>`);
										bindUnassign();
										bindAssignSearch();
										resetAndLoad();
									},
									error: () => frappe.msgprint(__("Could not assign.")),
								});
							});
							resetAndLoad();
						},
						error: () => frappe.msgprint(__("Could not remove assignment.")),
					});
				});
			}
			bindUnassign();
			bindAssignSearch();

			// Top action buttons: pass last chat text (maybe "") as preset.
			d.$wrapper.find("[data-wf-idx]").on("click", function () {
				const L = (typeof list !== "undefined" && list) || [];
				const lastText = L.length ? ((L[L.length - 1] || {}).text || "") : "";
				doWfAction(wfActions[+$(this).data("wf-idx")], lastText);
			});

			// ── Workflow action from dialog (shared runner + close dialog) ──
			function doWfAction(a, preset) {
				runWfAction(ticket, a, preset, () => { d.hide(); resetAndLoad(); });
			}

			function sendMsg() {
				const text = ($ta.val() || "").trim();
				if (!text) return;
				$ta.val("").css("height","auto");
				d.$wrapper.find("#asr-send-btn").prop("disabled", true);

				frappe.call({
					method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.add_ticket_comment",
					args:   { ticket, text },
					callback(r) {
						d.$wrapper.find("#asr-send-btn").prop("disabled", false);
						if (r.exc) return;
						frappe.call({
							method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_ticket_comments",
							args:   { ticket },
							callback(r2) {
								list = r2.message || [];
								renderMessages(list);
							},
						});
					},
				});
			}
		}

		frappe.call({
			method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_ticket_comments",
			args:   { ticket },
			callback(r) {
				// Fresh ticket state (table row may be stale) + detail pane data.
				frappe.call({ method: "frappe.client.get",
					args: { doctype: "Sahayog Ticket", name: ticket },
					callback(r2) {
						const fresh = (r2 && r2.message) || {};
						if (fresh.status) row.status = fresh.status;
						if (fresh.response_pending !== undefined) row.response_pending = fresh.response_pending || "";
						if (fresh.dept_name) row.dept_name = fresh.dept_name;
						if (fresh.executive_remark !== undefined) row.executive_remark = fresh.executive_remark || "";
						if (fresh.resolved_remark !== undefined) row.remark = fresh.resolved_remark || "";
						computeActions();
						frappe.call({
							method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_ticket_detail",
							args: { ticket: ticket },
							callback(r3) { buildUI(r.message || [], r3.message || {}); },
							error: () => buildUI(r.message || [], {}),
						});
					},
					error: () => buildUI(r.message || [], {}),
				});
			},
		});
	}

	// ── Export CSV (small → instant; large → background job) ─────────────────
	function exportCSV() {
		if (!state.total) { frappe.msgprint(__("No data to export.")); return; }

		frappe.call({
			method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.export_report",
			args: { filters: state.filters },
			callback(r) {
				const msg = r.message || {};

				if (msg.mode === "sync" && msg.content) {
					const blob = new Blob([msg.content], { type: "text/csv;charset=utf-8;" });
					const url  = URL.createObjectURL(blob);
					const a    = document.createElement("a");
					a.href     = url;
					a.download = msg.filename || `Account_Service_Report_${frappe.datetime.nowdate()}.csv`;
					a.click();
					URL.revokeObjectURL(url);
					return;
				}

				if (msg.mode === "queued") {
					// Listen once for the background export to finish.
					if (!state.exportListener) {
						state.exportListener = true;
						frappe.realtime.on("asr_export_ready", function (m) {
							frappe.msgprint({
								title: __("Report Ready"),
								message: __(
									"Your export ({0} rows) is ready: <a href=\"{1}\" target=\"_blank\">{2}</a>",
									[m.rows || "", m.file_url || "#", m.file_name || "Download"]
								),
								indicator: "green",
							});
						});
					}
					frappe.msgprint({
						title: __("Export Started"),
						message: __(
							"Large export ({0} rows) started in background. You will get a notification and an email with the download link.",
							[msg.total || 0]
						),
						indicator: "blue",
					});
					return;
				}

				frappe.msgprint(__("No data to export."));
			},
			error: () => frappe.msgprint(__("Could not start the export. Please try again.")),
		});
	}

	// ── Initial load ─────────────────────────────────────────────────────────
	function setTableHeight() {
		const navbarH    = $(".navbar").outerHeight(true) || 60;
		const pageHeadH  = $(wrapper).closest(".page-wrapper").find(".page-head").outerHeight(true) || 50;
		const summaryH   = 0; // summary chips removed
		const filterH    = $filterBar.outerHeight(true) || 0;
		const available  = window.innerHeight - navbarH - pageHeadH - summaryH - filterH - 2;
		$("#asr-table-wrap").css("height", available + "px");
	}

	$(window).on("resize", setTableHeight);

	setTimeout(() => {
		setTableHeight();
		resetAndLoad();
	}, 50);
};
