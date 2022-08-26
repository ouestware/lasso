import { FC } from "react";
import cx from "classnames";

export const NotFound: FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cx("container text-center col-6", className)}>
      <div className="row">
        <h1>Not Found</h1>
        <h2>The page you were looking for doesn't exist </h2>
        <p>You may have mistyped the address or the page may have moved.</p>
      </div>
    </div>
  );
};
