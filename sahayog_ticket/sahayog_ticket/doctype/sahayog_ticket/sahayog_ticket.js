// Copyright (c) 2023, Sid and contributors

// Hello from

frappe.ui.form.on("Sahayog Ticket", {
  after_save: function (frm) {
    if (frm.doc.on_hold_time == frm.doc.due_time) {
      console.log("True");
      console.log(frm.doc.on_hold_time);
      console.log(frm.doc.due_time);
      var dept = frm.doc.dept_name;
      frm.set_value("status", "Open");
      msgprint("Ticket is Saved Successfully.");
      msgprint(dept + " Team will Contact You Shortly");
      frappe.set_route("List", "Sahayog Ticket");
    } else {
      console.log("False");
      console.log(frm.doc.on_hold_time);
      console.log(frm.doc.due_time);
    }

    if (frm.doc.status == "Closed") {
      frm.set_df_property("status", "read_only", 1);

      frm.set_df_property("assigned_it", "read_only", 1);

      frm.set_df_property("remark", "read_only", 1);

      msgprint("Ticket is Closed Successfully . .");
      frm.disable_save();
    }

    if (frm.doc.cancel_ticket == "Cancel Ticket") {
      frm.set_df_property("status", "read_only", 1);

      frm.set_df_property("assigned_it", "read_only", 1);

      msgprint("Ticket is Cancelled Successfully . .");
      frm.disable_save();
    }
  },
});

frappe.ui.form.on("Sahayog Ticket", {
  refresh: function (frm) {
    if(frm.doc.dept_name == "" || null)
    {
      frm.doc.status = "New";
    }
    const onhold = 96;
    const onholdhit = 104;

    const normal = 72;
    const normalhit = 78;

    const medium = 48;
    const mediumhit = 54;

    const high = 24;
    const highhit = 28;

    const urgent = 4;
    const urgenthit = 6;

    //Start On-Hold Priority message
    if (
      frm.doc.total_hours < 104 &&
      frm.doc.total_hours >= onhold &&
      frm.doc.status == "On-Hold"
    ) {
      frappe.msgprint("On-Hold Ticket not Resolved in 96 Hours");
    }

    if (frm.doc.total_hours >= onholdhit && frm.doc.status == "On-Hold") {
      frappe.msgprint("On-Hold Ticket not Resolved in 104 Hours");
    }
    //End On-Hold Priority message

    //Start Urgent Priority message
    if (
      frm.doc.total_hours < 6 &&
      frm.doc.total_hours >= urgent &&
      frm.doc.priority == "Urgent"
    ) {
      frappe.msgprint("Ticket Priority was Urgent and not Resolved in 4 Hours");
    }

    if (frm.doc.total_hours >= urgenthit && frm.doc.priority == "Urgent") {
      frappe.msgprint("Ticket Priority was Urgent and not Resolved in 6 Hours");
    }
    //End Urgent Priority message

    //Start High Priority message
    if (
      frm.doc.total_hours < 28 &&
      frm.doc.total_hours >= high &&
      frm.doc.priority == "High"
    ) {
      frappe.msgprint("Ticket Priority was High and not Resolved in 24 Hours");
    }

    if (frm.doc.total_hours >= highhit && frm.doc.priority == "High") {
      frappe.msgprint("Ticket Priority was High and not Resolved in 28 Hours");
    }
    //End High Priority message

    //Start Medium Priority message
    if (
      frm.doc.total_hours < 54 &&
      frm.doc.total_hours >= medium &&
      frm.doc.priority == "Medium"
    ) {
      frappe.msgprint(
        "Ticket Priority was Medium and not Resolved in 48 Hours"
      );
    } else if (
      frm.doc.total_hours >= mediumhit &&
      frm.doc.priority == "Medium"
    ) {
      frappe.msgprint(
        "Ticket Priority was Medium and not Resolved in 54 Hours"
      );
    }
    //End Medium Priority message

    //Start Normal Priority message
    if (frm.doc.total_hours >= normalhit && frm.doc.priority == "Normal") {
      frappe.msgprint(
        "Ticket Priority was Normal and not Resolved in 78 Hours"
      );
    }
    if (
      frm.doc.total_hours < 78 &&
      frm.doc.total_hours >= normal &&
      frm.doc.priority == "Normal"
    ) {
      frappe.msgprint(
        "Ticket Priority was Normal and not Resolved in 72 Hours"
      );
    }
    //End Normal Priority message
  },
});

frappe.ui.form.on("Sahayog Ticket", {
  after_save: function (frm) {
    //frm.save();
  },
});
frappe.ui.form.on("Sahayog Ticket", {
  onload: function (frm) {
    
    if ((frm.doc.dept_name == null || "") && (frm.doc.desc == null || "")) {
      console.log("its blank");
    } else if (
      (!frm.doc.dept_name == null || "") &&
      (!frm.doc.desc == null || "") 
    ){
      frm.save();
    }

    if ( frm.doc.status == "Closed" || frm.doc.status == "Cancelled" ) 
    {
      frm.disable_save();
     
    }
   else if (frm.doc.status !== "Closed" || frm.doc.status !== "Cancelled") {
      frm.set_value("due_time", frappe.datetime.now_datetime());

      frm.set_value(
        "total_hours",
        frappe.datetime.get_hour_diff(frm.doc.due_time, frm.doc.on_hold_time)
      );

      frm.set_value(
        "total_days",
        frappe.datetime.get_day_diff(frm.doc.due_time, frm.doc.on_hold_time)
      );
    
    }
  

    if (frm.doc.status == "Open") {
      frm.set_intro('Ticket Status : Open', 'orange');
  }
  if (frm.doc.status == "Read") {
    frm.set_intro('Ticket Status : Read', 'blue');
}

if (frm.doc.status == "In-Progress") {
  frm.set_intro('Ticket Status : In-Progress', 'green');
}
if (frm.doc.status == "On-Hold") {
frm.set_intro('Ticket Status : On-Hold', 'yellow');
}


  },
});
