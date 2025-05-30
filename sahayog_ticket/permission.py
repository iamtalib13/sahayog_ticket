# -*- coding: utf-8 -*-
# Copyright (c) 2025, Your Company
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe

def get_permission_query_conditions():
    """Returns SQL conditions to restrict Sahayog Ticket visibility"""
    user = frappe.session.user
    
    if user == "Administrator":
        return ""
    
    conditions = []
    roles = frappe.get_roles(user)
    
    # Tickets owned by user
    conditions.append(f"`tabSahayog Ticket`.owner = {frappe.db.escape(user)}")
    
    # Department access
    departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", roles]},
        pluck="parent"
    )
    
    if departments:
        escaped_departments = [frappe.db.escape(dept) for dept in departments]
        conditions.append(f"`tabSahayog Ticket`.dept_name IN ({', '.join(escaped_departments)})")
    
    # Standard permissions check (except for System Manager)
    if "System Manager" not in roles:
        standard_perms = frappe.permissions.get_permission_query_conditions("Sahayog Ticket")
        if standard_perms:
            conditions.append(standard_perms)
    
    return "(" + " OR ".join(conditions) + ")" if conditions else ""

def has_permission(doc, ptype):
    """Document-level permission check"""
    user = frappe.session.user
    
    if user == "Administrator":
        return True
    
    if doc.get("owner") == user:
        return True
    
    if frappe.has_permission("Sahayog Ticket", ptype=ptype):
        return True
    
    user_departments = frappe.get_all(
        "Departsection Role",
        filters={"role": ["in", frappe.get_roles(user)]},
        pluck="parent"
    )
    
    return doc.get("dept_name") in user_departments