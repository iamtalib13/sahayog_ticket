import frappe
from frappe import _
import psycopg2
from psycopg2.extras import RealDictCursor


def db_connection():
    """Connect to external PostgreSQL (Finacle)."""
    try:
        creds = frappe.get_single("Finacle Settings")
        return psycopg2.connect(
            host=creds.host,
            port=creds.port,
            user=creds.user,
            password=creds.get_password("password"),
            database=creds.database_name
        )
    except Exception as e:
        frappe.throw(_("Database Connection Error: {0}").format(str(e)))


@frappe.whitelist()
def get_account_details(account_number):
    """
    Fetch account details (ONLY return, do NOT save)
    """
    conn = db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        query = """
            select 
                g.cif_id,
                g.acct_name,
                g.schm_type,
                p.email,
                p.phoneno
            from crmuser.cphone c, 
                 tbaadm.gam g, 
                 crmuser.phoneemail p
            where g.cif_id = c.phone_b2kid 
              and g.cif_id = p.orgkey
              and g.entity_cre_flg = 'Y' 
              and g.del_flg = 'N' 
              and c.preferredflag = 'Y' 
              and g.foracid = %s;
        """

        cursor.execute(query, (account_number,))
        data = cursor.fetchone()

        if not data:
            frappe.throw(_("No account details found for this Account Number."))

        # Return matching child table fields
        return {
            "cif": data.get("cif_id"),
            "customer_name": data.get("acct_name"),
            "contact_number": data.get("phoneno"),
            "account_type": data.get("schm_type"),
            "email": data.get("email"),
        }

    except Exception as e:
        frappe.throw(_("Unable to fetch account details: {0}").format(str(e)))

    finally:
        cursor.close()
        conn.close()



@frappe.whitelist()
def test():
    print("test")