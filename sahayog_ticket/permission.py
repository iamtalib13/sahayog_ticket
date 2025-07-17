
# -*- coding: utf-8 -*-
# Copyright (c) 2025, Your Company
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.utils import cint

def get_user_departments(user):
    """Get departments associated with user's roles"""
    if not user:
        user = frappe.session.user
    
    if user == "Administrator":
        return []  # Empty list means no department filtering for admin

    roles = frappe.get_roles(user)
    return frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    ) or []

def get_permission_query_conditions(user):
    if not user:
        user = frappe.session.user

    if user == "Administrator":
        return ""  # No restrictions for admin

    departments = get_user_departments(user)
    user_escaped = frappe.db.escape(user)

    conditions = []
    
    # Condition 1: Owner can always see their tickets
    conditions.append(f"`tabSahayog Ticket`.owner = {user_escaped}")
    
    # Condition 2: Department members can see tickets in their department
    if departments:
        dept_list = ", ".join([frappe.db.escape(dept) for dept in departments])
        conditions.append(
            f"(`tabSahayog Ticket`.dept_name IN ({dept_list}) AND "
            f"IFNULL(`tabSahayog Ticket`.assigned_to, '') IN ('', {user_escaped}))"
        )
    
    # Condition 3: Assigned user can always see the ticket
    conditions.append(f"`tabSahayog Ticket`.assigned_to = {user_escaped}")
    
    return " OR ".join(conditions) if conditions else "0 = 1"

def has_permission(doc, ptype, user):
    if not user:
        user = frappe.session.user

    # 1. Administrator has full access
    if user == "Administrator":
        return True

    # 2. Owner has full access
    if doc.owner == user:
        return True

    # 3. Assigned user has full access
    if doc.assigned_to == user:
        return True

    # 4. Department members have conditional access
    departments = get_user_departments(user)
    if doc.dept_name in departments:
        # For read operations
        if ptype == "read":
            return True
        # For write operations, allow if unassigned or has special role
        elif ptype in ["write", "submit", "cancel", "delete"]:
            return (not doc.assigned_to or 
                   "Department Head" in frappe.get_roles(user))

    return False