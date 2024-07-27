frappe.ready(function () {
  frappe.web_form.after_save = function () {
    // Get the name of the document that was just saved
    let doc_name = frappe.web_form.doc.name;

    // Display the name value using a message dialog
    frappe.msgprint({
      title: "Document Saved",
      message: `The document name is: ${doc_name}`,
      indicator: "green",
    });
  };
});
