# -*- coding: utf-8 -*-
# Copyright (c) 2025, Your Company
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe

def get_permission_query_conditions(user):
    """
    Returns SQL conditions to restrict `Sahayog Ticket` records visible to the user.
    User can see:
    - Tickets they own
    - Tickets whose dept_name is in the departments mapped to user's roles via Departsection Role
    """
    if not user or user == "Administrator":
        return ""

    # Get all roles of the user
    roles = frappe.get_roles(user)

    # Get all departments mapped to user's roles via 'Departsection Role'
    departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    )

    # Condition to allow tickets owned by the user
    conditions = [f"`tabSahayog Ticket`.owner = {frappe.db.escape(user)}"]

    if departments:
        # Escape each department and join with commas without adding extra quotes
        escaped_departments = [frappe.db.escape(dept) for dept in departments]
        dept_list = ", ".join(escaped_departments)
        conditions.append(f"`tabSahayog Ticket`.dept_name IN ({dept_list})")

    # Combine conditions with OR operator
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
