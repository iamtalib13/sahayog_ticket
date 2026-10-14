frappe.pages["asr-report"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Account Service Report",
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
	};

	// Taskflow-style groups: Pending = Open+In-Progress, Completed = Closed+Resolved.
	const TAB_GROUPS = {
		pending:   ["Open", "In-Progress"],
		completed: ["Closed", "Resolved"],
	};

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
			<table id="asr-table" style="border-collapse:collapse;font-size:12.5px;width:2050px;min-width:2050px;table-layout:fixed;">
				<thead style="position:sticky;top:0;z-index:3;">
					<tr style="background:#f8fafc;border-bottom:2px solid rgba(65,124,125,0.2);">
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
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:180px;">Comments</th>
						<th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;color:#64748b;white-space:nowrap;width:130px;">Last Modified</th>
					</tr>
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
		"Open":        { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
		"In-Progress": { bg: "#fef3c7", color: "#b45309", border: "#fcd34d" },
		"Closed":      { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
		"Resolved":    { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
	};
		(TAB_GROUPS[state.mainTab] || []).forEach(s => {
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
		if (state.subStatus) return [state.subStatus];
		return TAB_GROUPS[state.mainTab] || [];
	}
	function applyFilters() {
	 // Tabs win when set; else fall back to the Status dropdown (as-is).
		let statuses = statusList();
		if (!statuses.length) {
			const s = $("#asr-filter-status").val();
			if (s) statuses = [s];
		}
		state.filters = {
			statuses:         statuses,
			response_pending: $("#asr-filter-rp").val(),
			request_type:     $("#asr-filter-rt").val(),
			sol_id:           $("#asr-filter-sol").val(),
			from_date:        $("#asr-filter-from").val(),
			to_date:          $("#asr-filter-to").val(),
		};
		resetAndLoad();
	}

	$("#asr-filter-status").on("change", () => {
		state.mainTab = "all";
		state.subStatus = "";
		renderTabs();
		applyFilters();
	});
	$("#asr-filter-rp, #asr-filter-rt, #asr-filter-sol").on("change", applyFilters);
	$("#asr-filter-from, #asr-filter-to").on("change", applyFilters);

	$("#asr-clear-btn").on("click", () => {
		$("#asr-filter-status,#asr-filter-rp,#asr-filter-rt,#asr-filter-sol").val("");
		$("#asr-filter-from,#asr-filter-to").val("");
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

	// ── Append rows ──────────────────────────────────────────────────────────
	function appendRows(rows) {
		const $tbody  = $("#asr-tbody");
		const tdBase  = `padding:9px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
		const tdGray  = `style="${tdBase}color:#475569;"`;
		const tdPlain = `style="${tdBase}"`;

		rows.forEach((r, idx) => {
			const rowIdx = $tbody.children().length + idx;
			const bg     = rowIdx % 2 === 0 ? "#fff" : "#fafafa";
			const mod    = formatModified(r.modified);

			const $tr = $(`<tr style="cursor:pointer;border-bottom:1px solid #f1f5f9;background:${bg};transition:background 0.1s ease;">
				<td style="${tdBase}font-weight:600;color:#417c7d;">${frappe.utils.escape_html(r.ticket)}</td>
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
				<td style="${tdBase}font-size:11.5px;color:#475569;white-space:nowrap;" title="${frappe.utils.escape_html((r.last_comment_by ? r.last_comment_by + ": " : "") + (r.last_comment || ""))}">
					${r.comments_count
						? `<span style="display:inline-block;min-width:20px;text-align:center;font-weight:700;font-size:11px;color:#1f5c5d;background:#e6f2f2;border:1px solid #417c7d;border-radius:999px;padding:0 6px;margin-right:6px;">${r.comments_count}</span>
						<button class="btn btn-xs btn-default asr-cmt-btn" data-ticket="${frappe.utils.escape_html(r.ticket)}" title="View all comments" style="padding:1px 7px;">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
						</button>`
						: "—"}
				</td>
				<td style="padding:9px 12px;overflow:hidden;border-left:1px solid #e2e8f0;">
					${mod.html}
				</td>
			</tr>`);

			$tr.on("mouseenter", function () {
				$(this).css("background", "rgba(65,124,125,0.05)");
			});
			$tr.on("mouseleave", function () {
				$(this).css("background", bg);
			});
			$tr.on("click", () => frappe.set_route("Form", "Sahayog Ticket", r.ticket));
			$tr.find(".asr-cmt-btn").on("click", function (e) {
				e.stopPropagation();
				showComments($(this).data("ticket"));
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
	function showComments(ticket) {
		frappe.call({
			method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_ticket_comments",
			args: { ticket: ticket },
			callback(r) {
				const list = r.message || [];
				const initial = (n) => (n || "?").trim().charAt(0).toUpperCase();
				const body = list.length
					? list.map(c => `
						<div style="display:flex;gap:8px;margin-bottom:10px;">
							<div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;
								background:linear-gradient(135deg,#00b09b,#028a7a);color:#fff;
								display:flex;align-items:center;justify-content:center;
								font-size:13px;font-weight:700;">${frappe.utils.escape_html(initial(c.by))}</div>
							<div style="background:#fff;border:1px solid #e2e8f0;border-radius:4px 14px 14px 14px;
								padding:8px 12px;box-shadow:0 2px 6px rgba(0,0,0,0.06);max-width:100%;">
								<div style="font-size:11px;color:#64748b;margin-bottom:2px;">
									<b style="color:#0f766e;">${frappe.utils.escape_html(c.by || "—")}</b>
									${c.on ? " · " + frappe.utils.escape_html(fmtCmtDt(c.on)) : ""}
								</div>
								<div style="font-size:13px;color:#1e293b;white-space:pre-wrap;">${frappe.utils.escape_html(c.text || "")}</div>
							</div>
						</div>`).join("")
					: `<div style="color:#94a3b8;">No comments yet.</div>`;
				new frappe.ui.Dialog({
					title: __("Comments — {0}", [ticket]),
					size: "large",
					fields: [{ fieldtype: "HTML", options: `<div style="max-height:60vh;overflow:auto;background:#f8fafc;border-radius:12px;padding:12px;">${body}</div>` }],
				}).show();
			},
		});
	}

	// ── Export CSV ───────────────────────────────────────────────────────────
	function exportCSV() {
		if (!state.total) { frappe.msgprint(__("No data to export.")); return; }

		frappe.call({
			method: "sahayog_ticket.sahayog_ticket.page.asr_report.asr_report_api.get_report_data",
			args: { filters: state.filters, page_no: 1, page_size: state.total || 9999 },
			callback(r) {
				const data = (r.message || {}).data || [];
				if (!data.length) { frappe.msgprint(__("No data to export.")); return; }

				// helper: "YYYY-MM-DD" → "DD-MM-YYYY"
				function fmtDate(d) {
					if (!d) return "";
					return d.split("-").reverse().join("-");
				}

				// helper: "HH:MM:SS" or "HH:MM" → "hh:mm AM/PM"
				function fmtTime(t) {
					if (!t) return "";
					const parts = t.slice(0, 5).split(":");
					let h = parseInt(parts[0]);
					const mi = parts[1];
					const ampm = h >= 12 ? "PM" : "AM";
					h = h % 12 || 12;
					return String(h).padStart(2, "0") + ":" + mi + " " + ampm;
				}

				// helper: raw modified "YYYY-MM-DD HH:MM:SS" → "DD-MM-YYYY hh:mm AM/PM"
				function fmtModified(m) {
					if (!m) return "";
					const [datePart, timePart] = m.split(" ");
					return fmtDate(datePart) + " " + fmtTime(timePart);
				}

				const headers = [
					"Last Modified", "Ticket", "Creation Date", "Creation Time",
					"Request Type", "SOL ID", "Branch", "Status", "Response Pending",
					"Ticket Cycle", "Employee ID", "Employee Name",
					"State", "Zone", "Region", "District",
					"Resolved By", "Resolved Date", "Resolved Time", "Remark",
				];

				const csvRows = [headers.join(",")];
				data.forEach(row => {
					const vals = [
						fmtModified(row.modified),
						row.ticket,
						fmtDate(row.creation_date),
						fmtTime(row.creation_time),
						row.request_type,
						row.sol_id,
						row.branch,
						row.status,
						row.response_pending,
						row.ticket_cycle,
						row.employee_id,
						row.employee_name,
						row.state,
						row.zone,
						row.region,
						row.district,
						row.resolved_by,
						fmtDate(row.resolved_date),
						fmtTime(row.resolved_time),
						row.remark,
					];
					csvRows.push(vals.map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(","));
				});

				const blob = new Blob(["\uFEFF" + csvRows.join("\n"), ], { type: "text/csv;charset=utf-8;" });
				const url  = URL.createObjectURL(blob);
				const a    = document.createElement("a");
				a.href     = url;
				a.download = `Account_Service_Report_${frappe.datetime.nowdate()}.csv`;
				a.click();
				URL.revokeObjectURL(url);
			},
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
