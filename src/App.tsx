import { useState, useEffect, useRef, useMemo } from "react";
import { translate } from "./api";
import { Form, Button, Toast, Spin } from "@douyinfe/semi-ui";
import {
  IFieldMeta as FieldMeta,
  IWidgetTable,
  FieldType,
  IOpenSegmentType,
  ITableMeta,
  bitable,
  IRecord
} from "@lark-base-open/js-sdk";
import "./App.css";
import { icons } from "./icons";
import { useTranslation } from "react-i18next";

interface Selection {
  baseId: string | null, 
  tableId: string | null,
  fieldId: string | null,
  viewId: string | null, 
  recordId: string | null
}

//@ts-ignore
window.bitable = bitable;

let moreConfig = {
  /** 为true的时候表示，单元格如果有值，则不设置这个单元格,key为checkbox的value属性 */
  cover: true,
};

export function getMoreConfig() {
  return moreConfig;
}

export function setLoading(l: boolean) {
  loading = l;
  forceUpdateCom();
}

let loading = false;

let _forceUpdate: any;

export function forceUpdateCom() {
  return _forceUpdate({});
}

/** 表格，字段变化的时候刷新插件 */
export default function Ap() {
  const [key, setKey] = useState<string | number>(0);
  const [tableList, setTableList] = useState<IWidgetTable[]>([]);
  // 绑定过的tableId
  const bindList = useRef<Set<string>>(new Set());

  const refresh = useMemo(
    () => () => {
      const t = new Date().getTime();
      setKey(t);
    },
    []
  );

  useEffect(() => {
    bitable.base.getTableList().then((list) => {
      setTableList(list);
    });
    const deleteOff = bitable.base.onTableDelete(() => {
      setKey(new Date().getTime());
    });
    const addOff = bitable.base.onTableAdd(() => {
      setKey(new Date().getTime());
      bitable.base.getTableList().then((list) => {
        setTableList(list);
      });
    });
    bitable.base.onSelectionChange((event: { data: Selection }) => {
      console.log('current selection', event)
    })
    return () => {
      deleteOff();
      addOff();
    };
  }, []);

  useEffect(() => {
    if (tableList.length) {
      tableList.forEach((table) => {
        if (bindList.current.has(table.id)) {
          return;
        }
        table.onFieldAdd(refresh);
        table.onFieldDelete(refresh);
        table.onFieldModify(refresh);
        bindList.current.add(table.id);
      });
    }
  }, [tableList]);

  return <Translate key={key}></Translate>;
}

function Translate() {
  const { t } = useTranslation();
  const [btnDisabled, setBtnDisabled] = useState(true);
  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>();
  const [tableLoading, setTableLoading] = useState(false);
  const [tableId, setTableId] = useState<string>();
  const formApi = useRef<any>();
  const [, f] = useState();
  _forceUpdate = f;
  const [table, setTable] = useState<IWidgetTable>();
  const filedInfo = useRef<{
    text: FieldMeta[];
    select: FieldMeta[];
  }>({ text: [], select: [] });

  useEffect(() => {
    setTableLoading(true);
    bitable.base.getTableMetaList().then(async (r) => {
      setTableMetaList(r.filter(({ name }) => name));
      const choosedTableId = (await bitable.base.getSelection()).tableId;
      formApi.current.setValues({
        table: choosedTableId,
        others: Object.entries(moreConfig)
          .filter(([k, v]) => v)
          .map(([k, v]) => k),
      });
      setTableId(choosedTableId!);
      setTableLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!tableId) {
      return;
    }
    setLoading(true);
    formApi.current.setValue("targetField", "");
    formApi.current.setValue("sourceField", "");
    bitable.base.getTableById(tableId).then((table) => {
      setTable(table);
      const textArr: FieldMeta[] = [];
      const selectArr: FieldMeta[] = [];
      table.getFieldMetaList().then((m) => {
        Promise.allSettled(
          m.map(async (meta) => {
            switch (meta.type) {
              case FieldType.Text:
                textArr.push(meta);
                break;
              case FieldType.SingleSelect:
              case FieldType.MultiSelect:
                selectArr.push(meta);
                break;
              case FieldType.Lookup:
              case FieldType.Formula:
                const field = await table.getFieldById(meta.id);
                const proxyType = await field.getProxyType();
                if (proxyType === FieldType.Text) {
                  textArr.push(meta);
                } else if (
                  proxyType === FieldType.SingleSelect ||
                  proxyType === FieldType.MultiSelect
                ) {
                  selectArr.push(meta);
                }
                break;
              default:
                break;
            }
            return true;
          })
        ).finally(() => {
          filedInfo.current.text = textArr;
          filedInfo.current.select = selectArr;
          setLoading(false);
          forceUpdateCom();
        });
      });
    });
  }, [tableId]);

  const onClickStart = async () => {
    const {
      sourceField: sourceFieldId,
      targetField: targetFieldId,
    } = formApi.current.getValues();
    if (!sourceFieldId) {
      Toast.error(t("choose.sourceField"));
      return;
    }
    if (!targetFieldId) {
      Toast.error(t("choose.targetField"));
      return;
    }
    if (!tableId) {
      Toast.error(t("err.table"));
      return;
    }
    setLoading(true);
    const table = await bitable.base.getTableById(tableId);
    const sourceField = await table.getFieldById(sourceFieldId);
    const sourceValueList = await sourceField.getFieldValueList();
    console.log(sourceValueList);

    // 按照每 100 个元素为一组进行划分
    for (let i = 0; i < sourceValueList.length; i += 100) {
      const toTranslateList: any = [];
      let batch: Array<any> = sourceValueList.slice(i, i + 100);
      batch.forEach(({ record_id, value }, index) => {
        if (Array.isArray(value)) {
          toTranslateList.push({
            record_id: record_id,
            text: value.map(({ type, text }: any) => text).join(""),
          });
        }
      });
      const translateResult = await translate(toTranslateList);
      if (translateResult.code !== 0) {
        setLoading(false);
        Toast.error(t("err"));
        continue;
      }
      if (Array.isArray(translateResult.data)) {
        const records: Array<IRecord> = [];
        await translateResult.data.forEach(({ record_id, text }: any) =>
          records.push({
            recordId: record_id,
            fields:
            {
              [targetFieldId]: [
                { type: IOpenSegmentType.Text, text: text },
              ]
            }
          })
        );
        await table.setRecords(records);
      }
    }

    setLoading(false);
    Toast.success(t("success"));
  };

  const onFormChange = (e: any) => {
    const { sourceField, targetField } = e.values;
    if (!sourceField || !targetField) {
      setBtnDisabled(true);
    } else {
      setBtnDisabled(false);
    }
  };

  return (
    <div>
      <Spin spinning={loading || tableLoading}>
        <Form
          onChange={onFormChange}
          disabled={loading}
          getFormApi={(e) => {
            formApi.current = e;
          }}
        >
          <Form.Select
            onChange={(tableId) => setTableId(tableId as string)}
            field="table"
            label={t("choose.table")}
          >
            {Array.isArray(tableMetaList) &&
              tableMetaList.map(({ id, name }) => (
                <Form.Select.Option key={id} value={id}>
                  <div className="semi-select-option-text">{name}</div>
                </Form.Select.Option>
              ))}
          </Form.Select>
          <Form.Select
            field="sourceField"
            label={t("choose.sourceField")}
            placeholder={t("choose")}
          >
            {filedInfo.current.text.map((m) => {
              return (
                <Form.Select.Option value={m.id} key={m.id}>
                  <div className="semi-select-option-text">
                    {/* @ts-ignore */}
                    {icons[m.type]}
                    {m.name}
                  </div>
                </Form.Select.Option>
              );
            })}
          </Form.Select>
          <Form.Select
            field="targetField"
            label={t("choose.targetField")}
            placeholder={t("choose")}
          >
            {filedInfo.current.text.map((m) => {
              return (
                <Form.Select.Option value={m.id} key={m.id}>
                  <div className="semi-select-option-text">
                    {/* @ts-ignore */}
                    {icons[m.type]}
                    {m.name}
                  </div>
                </Form.Select.Option>
              );
            })}
          </Form.Select>
        </Form>
      </Spin>{" "}
      <br></br>
      <Button
        disabled={btnDisabled}
        type="primary"
        className="bt1"
        loading={loading}
        onClick={onClickStart}
      >
        {t("start.btn")}
      </Button>
    </div>
  );
}
