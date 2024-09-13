frappe.listview_settings["Sahayog Ticket"] = {
  hide_name_column: true,
  refresh: function (listview) {
    $(".layout-side-section").hide();
  },
  // Columns to fetch but not display
  //query_fields: ["select_department"],
  // Additional filters (array or object) for fetch query

  // query_filters: [["select_department", "in", ["IT"]]],

  // Only 50 rows will be displayed per page
  //  page_length: 20,
  // List data modify function
  // parser: function (data, render, error) {
  //   let names = [];
  //   data.forEach(function (row) {
  //     names.push(row.name);
  //   });
  //   if (!names.length) {
  //     return render();
  //   }
  //   frappe.db
  //     .get_list("Doctype", {
  //       fields: ["name", "price"],
  //       filters: {
  //         name: ["in", names],
  //         is_approved: 1,
  //       },
  //     })
  //     .then(function (list) {
  //       list.forEach(function (vals) {
  //         data.forEach(function (row) {
  //           if (vals.name === row.name) {
  //             row.price = vals.price;
  //           }
  //         });
  //       });
  //       // Render modified data
  //       render();
  //     })
  //     .catch(function (e) {
  //       console.error(e.message, e.stack);
  //       // Render original data instead
  //       error();
  //     });
  // },
  onload(listview) {
    // triggers once before the list is loaded
    if (frappe.user_roles.includes("IT Store Executive")) {
      //console.log("IT Store Executive");
    } else {
      // console.log("Else");
    }
  },
  set_row_background: function (row) {
    // if (row.status == "Draft") return "active";
    // if (row.status == "Pending") return "danger";
    // if (row.status == "Delivered") return "success";
    // if (row.status == "Received") return "info";
    // if (row.status == "Dispatched") return "primary";
    // if (row.status == "Rejected") return "danger";
  },

  // The fields listed above can be used inside the following functions
  // get_indicator: function (doc) {
  //   if (doc.is_paid) {
  //     return [__("Paid"), "blue", "is_paid,=,Yes|is_approved,=,Yes"];
  //   }
  //   if (doc.is_approved) {
  //     return [__("Approved"), "green", "is_paid,=,No|is_approved,=,Yes"];
  //   }
  //   return [__("Pending"), "gray", "is_paid,=,No|is_approved,=,No"];
  // },
  formatters: {
    // name: function (value, field, doc) {
    //   let html = value;
    //   if (doc.is_approved) {
    //     html += ' <span class="fa fa-check"></span>';
    //   }
    //   return html;
    // },
  },
};
