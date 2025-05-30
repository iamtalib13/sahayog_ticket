# -*- coding: utf-8 -*-
# Copyright (c) 2025, Your Company
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe

def get_permission_query_conditions(user):
    """
    Returns SQL conditions to restrict Sahayog Ticket records visible to the user.
    User can see:
    - Tickets they own
    - Tickets whose dept_name is in departments mapped to user's roles via Departsection Role
    - Tickets they have explicit permission to via role permissions
    """
    if not user or user == "Administrator":
        return ""

    conditions = []
    roles = frappe.get_roles(user)

    # Tickets owned by user
    conditions.append(f"`tabSahayog Ticket`.owner = {frappe.db.escape(user)}")

    # Get departments from Departsection Role
    departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    )

    if departments:
        escaped_departments = [frappe.db.escape(dept) for dept in departments]
        conditions.append(f"`tabSahayog Ticket`.dept_name IN ({', '.join(escaped_departments)})")

    # Include standard role permissions
    if "System Manager" not in roles:
        standard_perms = frappe.permissions.get_permission_query_conditions("Sahayog Ticket", user)
        if standard_perms:
            conditions.append(standard_perms)

    return "(" + " OR ".join(conditions) + ")" if conditions else ""

def has_permission(doc, ptype, user):
    """
    Check document-level permission for Sahayog Ticket
    Allows access if:
    - User is Administrator
    - User owns the ticket
    - Ticket department matches user's department roles
    - User has standard role permissions
    """
    if user == "Administrator":
        return True

    if doc.get("owner") == user:
        return True

    # Check standard permissions first
    if frappe.has_permission("Sahayog Ticket", ptype=ptype, user=user):
        return True

    # Check department access
    user_departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", frappe.get_roles(user)]},
        pluck="parent"
    )

    return doc.get("dept_name") in user_departments