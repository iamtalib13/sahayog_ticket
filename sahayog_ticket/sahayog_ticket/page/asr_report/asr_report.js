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

	// ── Filter bar HTML ──────────────────────────────────────────────────────
	const $filterBar = $(`
		<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;
			padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;
			border-radius:8px 8px 0 0;">

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
				<button id="asr-export-btn" title="Export CSV"
					style="height:32px;padding:0 14px;display:inline-flex;align-items:center;gap:6px;
					background:#417c7d;color:#fff;border:none;border-radius:6px;
					font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
					⬇ Export CSV
				</button>
			</div>
		</div>
	`).appendTo(page.main);

	// ── Fix page overflow so only table scrolls ─────────────────────────────
	$(wrapper).closest(".layout-main-section").css("overflow", "hidden");
	$(wrapper).closest(".page-content").css("overflow", "hidden");

	// ── Table wrapper ────────────────────────────────────────────────────────
	const $tableWrap = $(`
		<div id="asr-table-wrap" style="overflow:auto;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;background:#fff;
			height:calc(100vh - 200px);">
			<table id="asr-table" style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:1400px;table-layout:fixed;">
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

	// ── Event bindings ───────────────────────────────────────────────────────
	function applyFilters() {
		state.filters = {
			status:           $("#asr-filter-status").val(),
			response_pending: $("#asr-filter-rp").val(),
			request_type:     $("#asr-filter-rt").val(),
			sol_id:           $("#asr-filter-sol").val(),
			from_date:        $("#asr-filter-from").val(),
			to_date:          $("#asr-filter-to").val(),
		};
		resetAndLoad();
	}

	$("#asr-filter-status, #asr-filter-rp, #asr-filter-rt, #asr-filter-sol").on("change", applyFilters);
	$("#asr-filter-from, #asr-filter-to").on("change", applyFilters);

	$("#asr-clear-btn").on("click", () => {
		$("#asr-filter-status,#asr-filter-rp,#asr-filter-rt,#asr-filter-sol").val("");
		$("#asr-filter-from,#asr-filter-to").val("");
		state.filters = {};
		resetAndLoad();
	});

	$("#asr-export-btn").on("click", () => exportCSV());

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

			$tbody.append($tr);
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
	setTimeout(() => resetAndLoad(), 50);
};
