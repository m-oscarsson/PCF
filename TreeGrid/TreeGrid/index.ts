import { IInputs, IOutputs } from "./generated/ManifestTypes";
import DataSetInterfaces = ComponentFramework.PropertyHelper.DataSetApi;
type DataSet = ComponentFramework.PropertyTypes.DataSet;

import * as $ from 'jquery';
import { isNull } from "util";
import { Component } from "react";
/*
/// <reference types="@types/[jstree]" />
*/

class jsTreeNodeState {
	opened: boolean;
	disabled: boolean;
	selected: boolean;
}
class jsTreeNode {
	id: string | null;
	text: string;
	parent: string;
	state: jsTreeNodeState;
	icon: string;
}

declare var Xrm: any;

export class TreeGrid implements ComponentFramework.StandardControl<IInputs, IOutputs> {

	private root: jsTreeNode;
	private treeData: jsTreeNode[] = [];
	private selectedItems: string[] = [];

	// Cached context object for the latest updateView
	private contextObj: ComponentFramework.Context<IInputs>;
	// Div element created as part of this control's main container
	private mainContainer: HTMLDivElement;

	private _initTreeHandler: any;
	private _successCallback: any;
	private _setRootCallback: any;
	private _findRootCallback: any;
	private _onNodeCheckClick: any;
	private _entityMetadataSuccessCallback: any;

	private _mainEntityCollectionName: string;

	private _treeEntityName: string;
	private _treeParentAttribute: string;
	private _treeRootAttribute: string;
	private _treeNodeId: string;
	private _treeNodeName: string;
	private controlId: string;
	private container: HTMLDivElement;

	/**
	 * Empty constructor.
	 */
	constructor() {

	}

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
	 */
	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
		this.container = container;
		this.contextObj = context;
		// Need to track container resize so that control could get the available width. The available height won't be provided even this is true
		context.mode.trackContainerResize(true);
		// Create main table container div. 
		this.mainContainer = document.createElement("div");

		this.controlId = "foo";

		this.mainContainer.innerHTML = `
		
			<input id="search-input" class="search-input" placeholder="Type to search..." />
			<br />
			<div id="` + this.controlId + `" class="jstree-open" style="height: 62vh; overflow-y: auto; overflow-x: hidden;">
			  <ul>
				
			  </ul>
			</div>
		`;

		this._initTreeHandler = this.initTree.bind(this);

		var scriptElement = document.createElement("script");
		scriptElement.src = "https://cdnjs.cloudflare.com/ajax/libs/jstree/3.2.1/jstree.min.js"
		scriptElement.type = "text/javascript";
		container.appendChild(scriptElement);

		container.appendChild(this.mainContainer);

		var scriptElementOnLoad = document.createElement("script");
		scriptElementOnLoad.type = "text/javascript";
		scriptElementOnLoad.innerHTML = `
		    initTreeControl();
			
			function initTreeControl()
			{
				if(typeof($('#`+ this.controlId + `').jstree) == 'undefined')
				{
					setTimeout(initTreeControl, 500);
				}
				else
				{
					window.top.`+ this.controlId + `= $('#` + this.controlId + `');
					
				}
			}			

			$(document).ready(function () {
				$(".search-input").keyup(function () {					
					var searchString = $(".search-input").val();
					$('#`+ this.controlId + `').jstree('search', searchString);
				});
			
			});
		`;

		this.container.appendChild(scriptElementOnLoad);

		if (context.parameters.treeEntityName != null) {
			this._treeEntityName = context.parameters.treeEntityName.raw;
			this._treeNodeId = this._treeEntityName + "id";
		}
		if (context.parameters.treeNodeParentAttribute != null)
			this._treeParentAttribute = '_' + context.parameters.treeNodeParentAttribute.raw + '_value';
		if (context.parameters.treeNodeRootAttribute != null)
			this._treeRootAttribute = '_' + context.parameters.treeNodeRootAttribute.raw + '_value';
		if (context.parameters.treeNodeNameAttribute != null)
			this._treeNodeName = context.parameters.treeNodeNameAttribute.raw.toString();

		this._successCallback = this.successCallback.bind(this);
		this._findRootCallback = this.findRootCallback.bind(this);
		this._setRootCallback = this.setRootCallback.bind(this);
		this._onNodeCheckClick = this.nodeClick.bind(this);
		this._entityMetadataSuccessCallback = this.entityMetadataSuccessCallback.bind(this);

		(<any>Xrm).Utility.getEntityMetadata((<any>this.contextObj).page.entityTypeName, []).then(this._entityMetadataSuccessCallback, this.errorCallback);

		// Get root id	
		this.contextObj.webAPI.retrieveRecord((<any>this.contextObj).page.entityTypeName
			, (<any>this.contextObj).page.entityId
			, "?$select=" + this._treeRootAttribute + "," + this._treeNodeId).then(this._findRootCallback, this.errorCallback);
	}

	public entityMetadataSuccessCallback(value: any): void | PromiseLike<void> {
		this._mainEntityCollectionName = value.EntitySetName;
	}

	public addElements(value: any) {
		try {
			// console.log("addElements:");
			for (var i in value.entities) {
				var current: any = value.entities[i];

				var newNode: jsTreeNode = new jsTreeNode();
				newNode.id = current[this._treeNodeId];
				newNode.text = current[this._treeNodeName];
				newNode.parent = current[this._treeParentAttribute];
				this.treeData.push(newNode);
			}
			// console.log(this.treeData);
		} catch (error) {
			console.log(error);
		}
	}

	// find the top node
	public findRootCallback(value: any): void | PromiseLike<void> {
		try {
			// console.log("findRootCallback:")
			// console.log(value);
			var rootId = value[this._treeNodeId];
			if (value[this._treeRootAttribute]) rootId = value[this._treeRootAttribute];

			this.contextObj.webAPI.retrieveRecord((<any>this.contextObj).page.entityTypeName, rootId).then(this._setRootCallback, this.errorCallback);

		} catch (error) {
			console.log(error);
		}
	}

	// set top node of tree
	public setRootCallback(value: any): void | PromiseLike<void> {
		try {
			// console.log("setRootCallback:")
			// console.log(value);
			var root = new jsTreeNode();
			root.id = value[this._treeNodeId];
			root.text = value[this._treeNodeName];
			root.parent = "#";
			this.treeData.push(root);

			// filter all records that are related to the root attribute
			var filter = "?$filter=" + this._treeRootAttribute + " eq " + value[this._treeNodeId] + "&$orderby=" + this._treeNodeName + " asc";
			// console.log("setRootCallback: " + filter);

			this.contextObj.webAPI.retrieveMultipleRecords(this._treeEntityName
				, filter
				, 5000)
				.then(this._successCallback, this.errorCallback);
		} catch (error) {
			console.log(error);
		}
	}

	public successCallback(value: any): void | PromiseLike<void> {
		try {
			// console.log("successCallback:");
			// console.log(value);
			this.addElements(value);
			this.initTree();
		} catch (error) {
			console.log(error);
		}
	}

	public errorCallback(value: any) {
		console.log(value);
	}

	public initTree(): void {
		try {
			// console.log("initTree:");
			if ((<any>window).top[this.controlId].jstree == null) {
				setTimeout(this._initTreeHandler, 500);
			}
			else {
				(<any>window).top[this.controlId]
					.jstree({
						"plugins": ["state", "search"],
						"state": { "key": "treekey" },
						"search": {
							"case_sensitive": false
							//"show_only_matches": true
						},
						"core": {
							"data": this.treeData,
							"multiple": false
						}						
					})
					.on('select_node.jstree', function (e: any, data: any) {
						if (data.event) {
							data.instance.select_node(data.node.id);
						}
					})
					.on('deselect_node.jstree', function (e: any, data: any) {
						if (data.event) {
							data.instance.deselect_node(data.node.id);
						}
					});				

				var _self = this;
				(<any>window).top[this.controlId].bind("changed.jstree",
					function (e: any, data: any) {
						setTimeout(function () { _self._onNodeCheckClick(data); }, 50);
					}
				);
			}
		} catch (error) {
			console.log(error);
		}
	}

	public nodeClick(data: any) {
		try {
			console.log("nodeClick:");
			console.log(data.event);
			if (data.action == "select_node") {

				if (typeof data.event != "undefined" && data.event.type == "click") {
					console.log("click");
					var entityFormOptions: any = {};
					entityFormOptions["entityName"] = (<any>this.contextObj).page.entityTypeName;
					entityFormOptions["entityId"] = data.node.id;

					// Open the form.
					Xrm.Navigation.openForm(entityFormOptions).then(
						function (success: any) {
							console.log(success);
						},
						function (error: any) {
							console.log(error);
						});
				}	
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
	public updateView(context: ComponentFramework.Context<IInputs>): void {
		// Add code to update control view
	}

	/** 
	 * It is called by the framework prior to a control receiving new data. 
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
	 */
	public getOutputs(): IOutputs {
		return {};
	}

	/** 
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
	public destroy(): void {
		// Add code to cleanup control if necessary
	}
}