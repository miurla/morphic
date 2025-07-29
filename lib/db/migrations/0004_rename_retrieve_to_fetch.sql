-- Migration: Rename retrieve tool columns to fetch
-- This migration renames the tool_retrieve_* columns to tool_fetch_*
-- to align with the renamed tool from 'retrieve' to 'fetch'

-- Rename tool_retrieve_input to tool_fetch_input
ALTER TABLE parts 
RENAME COLUMN tool_retrieve_input TO tool_fetch_input;

-- Rename tool_retrieve_output to tool_fetch_output
ALTER TABLE parts 
RENAME COLUMN tool_retrieve_output TO tool_fetch_output;