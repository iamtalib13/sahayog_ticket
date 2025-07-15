
# -*- coding: utf-8 -*-
# Copyright (c) 2025, Your Company
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe

def get_permission_query_conditions(user):
    if not user or user == "Administrator":
        return ""

    roles = frappe.get_roles(user)

    # Get departments mapped to user's roles
    departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    )

    if not departments:
        return ""  # No dept access

    user_escaped = frappe.db.escape(user)
    escaped_departments = [frappe.db.escape(dept) for dept in departments]
    dept_list = ", ".join(escaped_departments)

    conditions = []

    # ✅ CASE 1: Dept match & assigned_to is empty
    conditions.append(
        f"(`tabSahayog Ticket`.dept_name IN ({dept_list}) AND "
        f"(`tabSahayog Ticket`.assigned_to IS NULL OR `tabSahayog Ticket`.assigned_to = ''))"
    )

    # ✅ CASE 2: Dept match & assigned_to is the current user
    conditions.append(
        f"(`tabSahayog Ticket`.dept_name IN ({dept_list}) AND "
        f"`tabSahayog Ticket`.assigned_to = {user_escaped})"
    )

    return " OR ".join(conditions)




def has_permission(doc, ptype, user):
    """
    Checks if the user has permission to access the given document.
    Permission granted if:
    - User is Administrator
    - User owns the document
    - Document's dept_name is in user's departments (mapped via roles)
    """
    if user == "Administrator":
        return True

    if doc.owner == user:
        return True

    # Get all roles of the user
    roles = frappe.get_roles(user)

    # Get all departments mapped to user's roles
    departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    )

    return doc.get("dept_name") in departments